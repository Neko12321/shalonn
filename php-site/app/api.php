<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/content.php';
require_once __DIR__ . '/finance.php';
require_once __DIR__ . '/admin.php';
require_once __DIR__ . '/files.php';

function dispatch(string $action, array $body): mixed
{
    switch ($action) {
        case 'bootstrap':
            $me = session_user('member'); $staff = session_user('staff'); $partner = session_user('affiliate');
            $ref = current_referral();
            return ['csrf' => $_SESSION['csrf'], 'content' => published_content(), 'settings' => setting('site', default_settings()),
                'me' => $me ? user_view($me, true) : null, 'staff' => $staff ? user_view($staff, true) : null,
                'partner' => $partner ? user_view($partner, true) : null,
                'referral' => $ref ? ['code' => $ref['promo_code'], 'name' => $ref['first_name'] ?: $ref['username']] : null];
        case 'login': return login_user($body, 'member');
        case 'admin.login': return login_user($body, 'staff');
        case 'affiliate.login': return login_user($body, 'affiliate');
        case 'logout': unset($_SESSION['member']); return null;
        case 'admin.logout': unset($_SESSION['staff']); return null;
        case 'affiliate.logout': unset($_SESSION['affiliate']); return null;
        case 'register': return register_member($body);
        case 'referral.resolve': return resolve_referral(field($body, 'code', 40));
        case 'affiliate.members': return affiliate_members();
        case 'admin.affiliateMembers': return affiliate_members(field($body, 'id', 32, true));
        case 'resetPassword': request_reset($body); return null;
        case 'completeReset': complete_reset($body); return null;
        case 'updatePassword': change_password($body, 'member'); return null;
        case 'admin.password': change_password($body, 'staff'); return null;
        case 'affiliate.password': change_password($body, 'affiliate'); return null;
        case 'deposit': return payment_request($body, 'deposit');
        case 'withdraw': return payment_request($body, 'withdraw');
        case 'transactions': return transaction_list(require_member()['id']);
        case 'bets': return bet_list(require_member()['id']);
        case 'messages': return query('SELECT id,title,body,status,created_at FROM messages WHERE user_id=? AND incoming=0 ORDER BY created_at DESC LIMIT 500', [require_member()['id']])->fetchAll();
        case 'placeBet': return place_bet($body);
        case 'launchGame': return launch_game($body);
        case 'admin.state': return admin_state();
        case 'admin.saveContent': return save_content($body);
        case 'admin.deleteContent':
            $type = field($body, 'type', 32, true); $staff = require_staff(content_permission($type));
            $id = field($body, 'id', 64, true);
            query('DELETE FROM content WHERE type=? AND id=?', [$type, $id]); audit('content.delete', $id, $staff['id']); return null;
        case 'admin.saveStaff': return save_staff($body);
        case 'admin.userStatus': set_user_status($body); return null;
        case 'admin.paymentDecision': decide_payment($body); return null;
        case 'admin.adjustBalance': adjust_balance($body); return null;
        case 'admin.settleBet': settle_bet($body); return null;
        case 'admin.settings': save_site_settings($body); return null;
        case 'admin.export': return export_content();
        case 'admin.import': import_content($body); return null;
        case 'admin.upload': return upload_file();
        case 'verifyIdentity': return upload_file(true);
        case 'admin.documentDecision':
            $staff = require_staff('players'); $id = field($body, 'id', 32, true);
            query("UPDATE files SET status=? WHERE id=? AND kind='identity'", [($body['approve'] ?? false) ? 'completed' : 'cancelled', $id]);
            audit('document.reviewed', $id, $staff['id']); return null;
        case 'contact':
            rate_limit('contact', 8, 3600); $member = session_user('member');
            $name = field($body, 'name', 100, true); $email = field($body, 'email', 254, true);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) abort_api('Geçerli e-posta adresi girin.');
            query('INSERT INTO messages(id,user_id,sender,email,title,body,incoming,created_at) VALUES(?,?,?,?,?,?,1,?)', [uid(), $member['id'] ?? null, $name, $email, field($body, 'subject', 150, true), field($body, 'message', 4000, true), now()]); return null;
        case 'admin.reply':
            $staff = require_staff('support'); $id = field($body, 'id', 32, true);
            $message = query('SELECT * FROM messages WHERE id=? AND incoming=1', [$id])->fetch();
            if (!$message) abort_api('Mesaj bulunamadı.', 404);
            if (!$message['user_id']) abort_api('Misafir mesajına belirtilen e-posta üzerinden yanıt verin.');
            $answer = field($body, 'body', 4000, true);
            atomic(function () use ($message, $answer, $staff) {
                query('INSERT INTO messages(id,user_id,title,body,created_at) VALUES(?,?,?,?,?)', [uid(), $message['user_id'], 'Destek: ' . $message['title'], $answer, now()]);
                query("UPDATE messages SET status='completed' WHERE id=?", [$message['id']]);
                audit('support.reply', $message['id'], $staff['id']);
            }); return null;
        case 'updateProfile':
            $member = require_member(); $email = field($body, 'email', 254, true); $phone = field($body, 'phone', 20, true);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/^\+[1-9][0-9]{7,14}$/', $phone)) abort_api('E-posta ve telefon bilgilerini kontrol edin.');
            if (query('SELECT id FROM users WHERE email=? COLLATE NOCASE AND id<>?', [$email, $member['id']])->fetch()) abort_api('Bu e-posta kullanılıyor.', 409);
            query('UPDATE users SET email=?,phone=? WHERE id=?', [$email, $phone, $member['id']]);
            return user_view(query('SELECT * FROM users WHERE id=?', [$member['id']])->fetch(), true);
        case 'updateLimits':
            $member = require_member(); $limit = cents($body['depositLimit'] ?? ''); $minutes = (int)($body['sessionMinutes'] ?? 0);
            if (!in_array($minutes, [30,60,120], true)) abort_api('Oturum süresi seçin.');
            query('UPDATE users SET daily_limit=?,session_minutes=? WHERE id=?', [$limit, $minutes, $member['id']]); return null;
        case 'selfExclude':
            $member = require_member();
            query('UPDATE users SET excluded_until=?,session_version=session_version+1 WHERE id=?', [gmdate('Y-m-d\TH:i:s\Z', time() + 30 * 86400), $member['id']]);
            audit('self.excluded', $member['id'], $member['id']); unset($_SESSION['member']); return null;
        default: abort_api('İşlem bulunamadı.', 404);
    }
}