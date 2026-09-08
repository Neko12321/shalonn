<?php
declare(strict_types=1);

function transaction_list(?string $user = null): array
{
    $rows = $user ? query('SELECT t.*,u.username FROM transactions t JOIN users u ON t.user_id=u.id WHERE user_id=? ORDER BY created_at DESC LIMIT 1000', [$user])->fetchAll()
        : query('SELECT t.*,u.username FROM transactions t JOIN users u ON t.user_id=u.id ORDER BY created_at DESC LIMIT 2000')->fetchAll();
    return array_map(function ($row) { $row['amount'] = (int)$row['amount'] / 100; return $row; }, $rows);
}

function bet_list(?string $user = null): array
{
    $rows = $user ? query('SELECT b.*,u.username FROM bets b JOIN users u ON b.user_id=u.id WHERE user_id=? ORDER BY created_at DESC LIMIT 1000', [$user])->fetchAll()
        : query('SELECT b.*,u.username FROM bets b JOIN users u ON b.user_id=u.id ORDER BY created_at DESC LIMIT 2000')->fetchAll();
    return array_map(function ($row) { $row['stake'] = (int)$row['stake'] / 100; $row['payout'] = (int)$row['payout'] / 100; $row['selections'] = decode($row['selections']); return $row; }, $rows);
}

function request_key(array $body): string
{
    $key = field($body, 'requestKey', 80, true);
    if (!preg_match('/^[a-zA-Z0-9_-]{16,80}$/', $key)) abort_api('İşlem kimliği geçersiz.');
    return $key;
}

function payment_request(array $body, string $direction): array
{
    $member = require_member();
    rate_limit('payment:' . $member['id'], 20, 900);
    $amount = cents($body['amount'] ?? '');
    $methodId = field($body, 'methodId', 64, true);
    $key = request_key($body);
    $destination = field($body, 'destination', 255);
    return atomic(function () use ($member, $amount, $methodId, $direction, $key, $destination) {
        $existing = query('SELECT * FROM transactions WHERE user_id=? AND request_key=?', [$member['id'], $key])->fetch();
        if ($existing) {
            if ($existing['direction'] !== $direction || (int)$existing['amount'] !== $amount) abort_api('İşlem kimliği başka bir tutar için kullanılmış.', 409);
            return ['id' => $existing['id']];
        }
        $row = query("SELECT * FROM content WHERE id=? AND type='paymentMethods' AND active=1", [$methodId])->fetch();
        $method = $row ? decode($row['data']) : null;
        if (!$method || empty($method[$direction])) abort_api('Ödeme yöntemi kullanılamıyor.');
        if ($amount < cents($method['minimum']) || $amount > cents($method['maximum'])) abort_api('Tutar, ödeme yönteminin limitleri dışında.');
        $user = query('SELECT * FROM users WHERE id=?', [$member['id']])->fetch();
        if ($direction === 'withdraw') {
            if ((int)$user['balance'] - (int)$user['reserved'] < $amount) abort_api('Kullanılabilir bakiye yetersiz.');
            if (strlen($destination) < 6) abort_api('Alıcı hesap bilgilerini girin.');
            query('UPDATE users SET reserved=reserved+? WHERE id=?', [$amount, $member['id']]);
        } elseif ($user['daily_limit'] !== null) {
            $total = (int)query("SELECT COALESCE(SUM(amount),0) FROM transactions WHERE user_id=? AND direction='deposit' AND status<>'cancelled' AND created_at>=?", [$member['id'], gmdate('Y-m-d\T00:00:00\Z')])->fetchColumn();
            if ($amount + $total > (int)$user['daily_limit']) abort_api('Günlük yatırım limitiniz aşılıyor.');
        }
        $id = uid();
        query('INSERT INTO transactions(id,user_id,direction,amount,status,method,destination,request_key,created_at) VALUES(?,?,?,?,?,?,?,?,?)', [$id, $member['id'], $direction, $amount, 'pending', $method['name'], $destination, $key, now()]);
        audit('payment.request', $id, $member['id']);
        return ['id' => $id];
    });
}

function decide_payment(array $body): void
{
    $staff = require_staff('finance');
    $id = field($body, 'id', 32, true);
    $approve = ($body['approve'] ?? false) === true;
    atomic(function () use ($staff, $id, $approve) {
        $row = query('SELECT * FROM transactions WHERE id=?', [$id])->fetch();
        if (!$row || $row['status'] !== 'pending') abort_api('Talep zaten sonuçlandırılmış veya bulunamadı.', 409);
        $amount = (int)$row['amount'];
        if ($row['direction'] === 'withdraw') {
            query('UPDATE users SET balance=balance-?,reserved=reserved-? WHERE id=?', [$approve ? $amount : 0, $amount, $row['user_id']]);
        } elseif ($row['direction'] === 'deposit' && $approve) query('UPDATE users SET balance=balance+? WHERE id=?', [$amount, $row['user_id']]);
        query('UPDATE transactions SET status=?,resolved_at=?,resolved_by=? WHERE id=?', [$approve ? 'completed' : 'cancelled', now(), $staff['id'], $id]);
        audit($approve ? 'payment.approved' : 'payment.rejected', $id, $staff['id']);
    });
}

function adjust_balance(array $body): void
{
    $staff = require_staff('finance');
    $id = field($body, 'id', 32, true);
    $amount = cents($body['amount'] ?? '', true);
    $note = field($body, 'note', 1000, true);
    $key = request_key($body);
    atomic(function () use ($staff, $id, $amount, $note, $key) {
        $user = query("SELECT * FROM users WHERE id=? AND role='member'", [$id])->fetch();
        if (!$user) abort_api('Oyuncu bulunamadı.', 404);
        $existing = query('SELECT * FROM transactions WHERE user_id=? AND request_key=?', [$id, $key])->fetch();
        if ($existing) { if ((int)$existing['amount'] !== $amount || $existing['direction'] !== 'adjustment') abort_api('İşlem kimliği çakışması.', 409); return; }
        if ((int)$user['balance'] + $amount < (int)$user['reserved']) abort_api('Bakiye bloke tutarın altına düşemez.');
        query('UPDATE users SET balance=balance+? WHERE id=?', [$amount, $id]);
        query('INSERT INTO transactions(id,user_id,direction,amount,status,note,request_key,created_at,resolved_at,resolved_by) VALUES(?,?,?,?,?,?,?,?,?,?)', [uid(), $id, 'adjustment', $amount, 'completed', $note, $key, now(), now(), $staff['id']]);
        audit('balance.adjusted', $id, $staff['id']);
    });
}

function place_bet(array $body): array
{
    $member = require_member();
    $stake = cents($body['stake'] ?? '');
    if ($stake > 10000000) abort_api('Bahis tutarı üst limitin üzerinde.');
    $key = request_key($body);
    $picks = $body['selections'] ?? [];
    if (!is_array($picks) || count($picks) < 1 || count($picks) > 20) abort_api('Kupona 1-20 seçim ekleyin.');
    return atomic(function () use ($member, $stake, $key, $picks) {
        $existing = query('SELECT id,stake FROM bets WHERE user_id=? AND request_key=?', [$member['id'], $key])->fetch();
        if ($existing) { if ((int)$existing['stake'] !== $stake) abort_api('İşlem kimliği çakışması.', 409); return ['id' => $existing['id']]; }
        $total = 1.0; $selections = []; $seen = [];
        foreach ($picks as $pick) {
            if (!is_array($pick)) abort_api('Geçersiz seçim.');
            $id = field($pick, 'matchId', 64, true);
            $index = array_search($pick['outcome'] ?? '', ['1', 'X', '2'], true);
            if ($index === false || isset($seen[$id])) abort_api('Aynı maç için birden fazla seçim yapılamaz.');
            $seen[$id] = true;
            $row = query("SELECT data FROM content WHERE id=? AND type='matches' AND active=1", [$id])->fetch();
            if (!$row) abort_api('Bir karşılaşma yayından kaldırıldı.');
            $match = decode($row['data']);
            if (!$match['live'] && strtotime($match['startsAt']) <= time()) abort_api('Başlamış bir karşılaşmanın oranı kullanılamaz.');
            $odd = (float)$match['odds'][$index];
            if (abs($odd - (float)($pick['odd'] ?? 0)) > 0.0001) abort_api('Oran değişti. Kuponunuzu tekrar oluşturun.', 409);
            $total *= $odd;
            if (!is_finite($total) || $total * $stake > 10000000000) abort_api('Kupon olası kazanç limitini aşıyor.');
            $selections[] = ['matchId' => $id, 'home' => $match['home'], 'away' => $match['away'], 'outcome' => $pick['outcome'], 'odd' => $odd];
        }
        $user = query('SELECT balance,reserved FROM users WHERE id=?', [$member['id']])->fetch();
        if ((int)$user['balance'] - (int)$user['reserved'] < $stake) abort_api('Kullanılabilir bakiye yetersiz.');
        query('UPDATE users SET balance=balance-? WHERE id=?', [$stake, $member['id']]);
        $id = uid();
        query('INSERT INTO bets(id,user_id,stake,odds,selections,request_key,created_at) VALUES(?,?,?,?,?,?,?)', [$id, $member['id'], $stake, $total, json_string($selections), $key, now()]);
        audit('bet.placed', $id, $member['id']);
        return ['id' => $id];
    });
}

function settle_bet(array $body): void
{
    $staff = require_staff('bets', true);
    $status = field($body, 'status', 12, true);
    if (!in_array($status, ['won', 'lost', 'cancelled'], true)) abort_api('Sonuç seçin.');
    $id = field($body, 'id', 32, true);
    atomic(function () use ($staff, $status, $id) {
        $bet = query('SELECT * FROM bets WHERE id=?', [$id])->fetch();
        if (!$bet || $bet['status'] !== 'pending') abort_api('Kupon zaten sonuçlandırılmış.', 409);
        $payout = $status === 'won' ? (int)round((int)$bet['stake'] * (float)$bet['odds']) : ($status === 'cancelled' ? (int)$bet['stake'] : 0);
        if ($payout) query('UPDATE users SET balance=balance+? WHERE id=?', [$payout, $bet['user_id']]);
        query('UPDATE bets SET status=?,payout=?,resolved_at=? WHERE id=?', [$status, $payout, now(), $id]);
        audit('bet.' . $status, $id, $staff['id']);
    });
}