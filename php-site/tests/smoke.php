<?php
declare(strict_types=1);

// Runs against a disposable database; never use production storage here.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$directory = sys_get_temp_dir() . '/shalom-test-' . bin2hex(random_bytes(6));
putenv('SHALOM_STORAGE=' . $directory);
putenv('SHALOM_ENV=local');
putenv('SHALOM_URL=http://localhost:8080');
require dirname(__DIR__) . '/app/install.php';
require dirname(__DIR__) . '/app/api.php';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$checks = 0;
function check(bool $value, string $label): void {
    global $checks;
    if (!$value) throw new RuntimeException('BASARISIZ: ' . $label);
    $checks++;
}

try {
    if (config()['storage'] !== $directory) throw new RuntimeException('Test icin ayri veri klasoru zorunlu. config.php SHALOM_STORAGE degiskenini kullanmali.');
    init_session();
    install_site('sistem_test', 'GuvenliTest_824623');
    check(installed(), 'kurulum');
    login_user(['username'=>'sistem_test', 'password'=>'GuvenliTest_824623'], 'staff');
    $partner = save_staff(['role'=>'affiliate','username'=>'ortak_test','name'=>'Test Ortak','password'=>'OrtakTest_627154','promoCode'=>'ORTAK_TEST','permissions'=>[]]);
    resolve_referral('ortak_test');
    $member = register_member(['username'=>'uye_test','firstName'=>'Deneme','lastName'=>'Kullanıcı','email'=>'test@example.test','country'=>'TR','phone'=>'+905321234567','birthDate'=>'1995-06-14','password'=>'UyeTest_728451','acceptedTerms'=>true]);
    check($member['affiliateId'] === $partner['id'], 'affiliate kimligi');
    check(count(affiliate_members($partner['id'])) === 1, 'ortak uye listesi');
    $partner['promoCode'] = 'YENI_KOD';
    save_staff(['id'=>$partner['id'],'role'=>'affiliate','username'=>'ortak_test','name'=>'Test Ortak','password'=>'','promoCode'=>'YENI_KOD','permissions'=>[]]);
    check(count(affiliate_members($partner['id'])) === 1, 'kod degisikliginde baglanti korunur');
    $method = save_content(['type'=>'paymentMethods','item'=>['name'=>'Test Yontemi','kind'=>'bank','description'=>'Test','minimum'=>10,'maximum'=>10000,'deposit'=>true,'withdraw'=>true,'active'=>true]]);
    $request = payment_request(['amount'=>100,'methodId'=>$method['id'],'requestKey'=>'test_deposit_123456'], 'deposit');
    decide_payment(['id'=>$request['id'],'approve'=>true]);
    check((int)query('SELECT balance FROM users WHERE id=?',[$member['id']])->fetchColumn() === 10000, 'yatirim bakiyesi');
    try { decide_payment(['id'=>$request['id'],'approve'=>true]); check(false,'cift onay'); } catch (ApiError $error) { check($error->status===409,'cift onay engeli'); }
    $withdrawal = payment_request(['amount'=>60,'methodId'=>$method['id'],'destination'=>'TR_TEST_ACCOUNT','requestKey'=>'test_withdraw_1234'], 'withdraw');
    check((int)query('SELECT reserved FROM users WHERE id=?',[$member['id']])->fetchColumn() === 6000,'cekim rezervi');
    try { payment_request(['amount'=>60,'methodId'=>$method['id'],'destination'=>'TR_TEST_ACCOUNT','requestKey'=>'test_withdraw_5678'],'withdraw'); check(false,'fazla cekim'); } catch (ApiError $error) { check(true,'fazla cekim engeli'); }
    decide_payment(['id'=>$withdrawal['id'],'approve'=>false]);
    check((int)query('SELECT reserved FROM users WHERE id=?',[$member['id']])->fetchColumn() === 0,'rezerv iadesi');
    $employee = save_staff(['role'=>'employee','username'=>'icerik_test','name'=>'Test Çalışan','password'=>'CalisanTest_272842','permissions'=>['games'],'status'=>'active']);
    login_user(['username'=>'icerik_test','password'=>'CalisanTest_272842'],'staff');
    try { require_staff('finance'); check(false,'yetki'); } catch (ApiError $error) { check($error->status===403,'yetki engeli'); }
    check(!array_key_exists('password', $employee), 'sifre gizliligi');
    session_write_close();
    fwrite(STDOUT, $checks . " kontrol basarili.\n");
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n"); exit(1);
} finally {
    foreach (glob($directory . '/*') ?: [] as $file) if (is_file($file)) unlink($file);
    if (is_dir($directory)) rmdir($directory);
}