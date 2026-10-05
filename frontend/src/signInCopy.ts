import type { MessageLang } from './languages'

/**
 * Words for signing in (Google or a code emailed to you), in each message language: the
 * welcome page uses English, and a capsule link asks in the capsule's language (spec.md >
 * Sign-in and sessions). Informal where the language has a choice, like the recipient's
 * opening (recipientCopy.ts).
 */
export type SignInCopy = {
  /** At the cake, before the candles: the capsule link's sign-in card */
  confirmTitle: string
  forEmail: (hint: string) => string
  wrongAccount: (email: string, hint: string) => string
  or: string
  continueWithEmail: string
  emailLabel: string
  sendCode: string
  sending: string
  codeSent: (email: string) => string
  codeLabel: string
  confirm: string
  checking: string
  resendIn: (seconds: number) => string
  resend: string
  otherEmail: string
  wrongCode: (triesLeft: number) => string
  expired: string
  tooSoon: string
  limit: string
  notSent: string
  badEmail: string
  /** A likely typo's fix; {email} is where the suggested address goes */
  didYouMean: string
  failed: string
  googleFailed: string
  /** Google's own button text (its `locale`) */
  googleLocale: string
}

export const SIGN_IN_COPY: Record<MessageLang, SignInCopy> = {
  en: {
    confirmTitle: "Make a wish first: confirm it's you",
    forEmail: (h) => `This capsule is for ${h}`,
    wrongAccount: (e, h) => `You're signed in as ${e}, but this capsule is for ${h}.`,
    or: 'or',
    continueWithEmail: 'Continue with email',
    emailLabel: 'Your email',
    sendCode: 'Send me a code',
    sending: 'Sending…',
    codeSent: (e) => `We sent a 6-digit code to ${e}. It can take a minute to arrive.`,
    codeLabel: '6-digit code',
    confirm: 'Confirm',
    checking: 'Checking…',
    resendIn: (s) => `Send a new code in ${s}s`,
    resend: 'Send a new code',
    otherEmail: 'Use a different email',
    wrongCode: (n) =>
      n > 0 ? `That code isn't right. ${n} ${n === 1 ? 'try' : 'tries'} left.` : 'That code is used up. Send a new one.',
    expired: 'That code has expired. Send a new one.',
    tooSoon: 'Wait a moment before asking for another code.',
    limit: 'Too many codes for now. Try again in an hour.',
    notSent: "We couldn't send the code. Please try again.",
    badEmail: 'Check your email address.',
    didYouMean: 'Did you mean {email}?',
    failed: 'Something went wrong. Please try again.',
    googleFailed: "Google couldn't confirm that sign-in. Please try again.",
    googleLocale: 'en',
  },
  ko: {
    confirmTitle: '먼저 소원을 빌어요: 본인인지 확인해 주세요',
    forEmail: (h) => `이 캡슐의 받는 사람: ${h}`,
    wrongAccount: (e, h) => `${e}(으)로 로그인되어 있지만, 이 캡슐은 ${h} 앞으로 왔어요.`,
    or: '또는',
    continueWithEmail: '이메일로 계속하기',
    emailLabel: '이메일',
    sendCode: '코드 받기',
    sending: '보내는 중…',
    codeSent: (e) => `${e}(으)로 6자리 코드를 보냈어요. 도착하는 데 1분 정도 걸릴 수 있어요.`,
    codeLabel: '6자리 코드',
    confirm: '확인',
    checking: '확인하는 중…',
    resendIn: (s) => `${s}초 후에 새 코드를 받을 수 있어요`,
    resend: '새 코드 받기',
    otherEmail: '다른 이메일 사용하기',
    wrongCode: (n) =>
      n > 0 ? `코드가 맞지 않아요. ${n}번 더 시도할 수 있어요.` : '이 코드는 더 이상 쓸 수 없어요. 새 코드를 받아 주세요.',
    expired: '코드가 만료됐어요. 새 코드를 받아 주세요.',
    tooSoon: '잠시 후에 다시 요청해 주세요.',
    limit: '코드를 너무 많이 요청했어요. 한 시간 후에 다시 시도해 주세요.',
    notSent: '코드를 보내지 못했어요. 다시 시도해 주세요.',
    badEmail: '이메일 주소를 확인해 주세요.',
    didYouMean: '혹시 {email} 인가요?',
    failed: '문제가 생겼어요. 다시 시도해 주세요.',
    googleFailed: 'Google 로그인을 확인하지 못했어요. 다시 시도해 주세요.',
    googleLocale: 'ko',
  },
  zh: {
    confirmTitle: '先许个愿：确认是你本人',
    forEmail: (h) => `这个胶囊是送给 ${h} 的`,
    wrongAccount: (e, h) => `你登录的是 ${e}，但这个胶囊是送给 ${h} 的。`,
    or: '或',
    continueWithEmail: '用邮箱继续',
    emailLabel: '你的邮箱',
    sendCode: '发送验证码',
    sending: '正在发送…',
    codeSent: (e) => `我们已向 ${e} 发送了 6 位验证码，可能需要一分钟才能收到。`,
    codeLabel: '6 位验证码',
    confirm: '确认',
    checking: '正在验证…',
    resendIn: (s) => `${s} 秒后可重新发送`,
    resend: '重新发送验证码',
    otherEmail: '换一个邮箱',
    wrongCode: (n) => (n > 0 ? `验证码不对，还可以试 ${n} 次。` : '这个验证码已失效，请重新发送。'),
    expired: '验证码已过期，请重新发送。',
    tooSoon: '请稍等片刻再请求新的验证码。',
    limit: '请求次数过多，请一小时后再试。',
    notSent: '验证码没能发送，请再试一次。',
    badEmail: '请检查你的邮箱地址。',
    didYouMean: '你是不是想输入 {email}？',
    failed: '出了点问题，请再试一次。',
    googleFailed: 'Google 无法确认这次登录，请再试一次。',
    googleLocale: 'zh_CN',
  },
  ja: {
    confirmTitle: 'まずは願い事を：ご本人か確認してください',
    forEmail: (h) => `このカプセルは ${h} 宛てです`,
    wrongAccount: (e, h) => `${e} でログインしていますが、このカプセルは ${h} 宛てです。`,
    or: 'または',
    continueWithEmail: 'メールで続ける',
    emailLabel: 'メールアドレス',
    sendCode: 'コードを送る',
    sending: '送信中…',
    codeSent: (e) => `${e} に6桁のコードを送りました。届くまで1分ほどかかることがあります。`,
    codeLabel: '6桁のコード',
    confirm: '確認する',
    checking: '確認中…',
    resendIn: (s) => `${s}秒後に新しいコードを送れます`,
    resend: '新しいコードを送る',
    otherEmail: '別のメールアドレスを使う',
    wrongCode: (n) =>
      n > 0 ? `コードが違います。あと${n}回試せます。` : 'このコードは使えなくなりました。新しいコードを送ってください。',
    expired: 'コードの有効期限が切れました。新しいコードを送ってください。',
    tooSoon: '少し待ってから、もう一度コードを送ってください。',
    limit: 'コードのリクエストが多すぎます。1時間後にもう一度お試しください。',
    notSent: 'コードを送信できませんでした。もう一度お試しください。',
    badEmail: 'メールアドレスを確認してください。',
    didYouMean: 'もしかして {email} ですか？',
    failed: '問題が発生しました。もう一度お試しください。',
    googleFailed: 'Googleでのログインを確認できませんでした。もう一度お試しください。',
    googleLocale: 'ja',
  },
  es: {
    confirmTitle: 'Primero pide un deseo: confirma que eres tú',
    forEmail: (h) => `Esta cápsula es para ${h}`,
    wrongAccount: (e, h) => `Iniciaste sesión como ${e}, pero esta cápsula es para ${h}.`,
    or: 'o',
    continueWithEmail: 'Continuar con el correo',
    emailLabel: 'Tu correo',
    sendCode: 'Envíame un código',
    sending: 'Enviando…',
    codeSent: (e) => `Enviamos un código de 6 dígitos a ${e}. Puede tardar un minuto en llegar.`,
    codeLabel: 'Código de 6 dígitos',
    confirm: 'Confirmar',
    checking: 'Comprobando…',
    resendIn: (s) => `Puedes pedir otro código en ${s} s`,
    resend: 'Enviar un código nuevo',
    otherEmail: 'Usar otro correo',
    wrongCode: (n) =>
      n > 0
        ? `Ese código no es correcto. ${n === 1 ? 'Te queda 1 intento' : `Te quedan ${n} intentos`}.`
        : 'Ese código ya no sirve. Pide uno nuevo.',
    expired: 'Ese código caducó. Pide uno nuevo.',
    tooSoon: 'Espera un momento antes de pedir otro código.',
    limit: 'Demasiados códigos por ahora. Inténtalo de nuevo en una hora.',
    notSent: 'No pudimos enviar el código. Inténtalo de nuevo.',
    badEmail: 'Revisa tu dirección de correo.',
    didYouMean: '¿Quisiste decir {email}?',
    failed: 'Algo salió mal. Inténtalo de nuevo.',
    googleFailed: 'Google no pudo confirmar el inicio de sesión. Inténtalo de nuevo.',
    googleLocale: 'es',
  },
  ta: {
    confirmTitle: 'முதலில் ஒரு ஆசை வேண்டுங்கள்: இது நீங்கள்தான் என்பதை உறுதிசெய்யுங்கள்',
    forEmail: (h) => `இந்தக் கேப்ஸ்யூல் ${h}-க்கானது`,
    wrongAccount: (e, h) => `நீங்கள் ${e} ஆக உள்நுழைந்துள்ளீர்கள், ஆனால் இந்தக் கேப்ஸ்யூல் ${h}-க்கானது.`,
    or: 'அல்லது',
    continueWithEmail: 'மின்னஞ்சல் மூலம் தொடரவும்',
    emailLabel: 'உங்கள் மின்னஞ்சல்',
    sendCode: 'குறியீட்டை அனுப்பு',
    sending: 'அனுப்புகிறது…',
    codeSent: (e) => `${e}-க்கு 6 இலக்கக் குறியீட்டை அனுப்பியுள்ளோம். வந்து சேர ஒரு நிமிடம் ஆகலாம்.`,
    codeLabel: '6 இலக்கக் குறியீடு',
    confirm: 'உறுதிசெய்',
    checking: 'சரிபார்க்கிறது…',
    resendIn: (s) => `${s} விநாடிகளில் புதிய குறியீட்டைக் கேட்கலாம்`,
    resend: 'புதிய குறியீட்டை அனுப்பு',
    otherEmail: 'வேறு மின்னஞ்சலைப் பயன்படுத்து',
    wrongCode: (n) =>
      n > 0
        ? `குறியீடு சரியில்லை. இன்னும் ${n} முறை முயற்சிக்கலாம்.`
        : 'இந்தக் குறியீடு இனி செல்லாது. புதியதைக் கேளுங்கள்.',
    expired: 'குறியீட்டின் காலம் முடிந்துவிட்டது. புதியதைக் கேளுங்கள்.',
    tooSoon: 'மற்றொரு குறியீட்டைக் கேட்கும் முன் சிறிது நேரம் காத்திருங்கள்.',
    limit: 'இப்போதைக்கு அதிகமான குறியீடுகள். ஒரு மணி நேரம் கழித்து முயற்சிக்கவும்.',
    notSent: 'குறியீட்டை அனுப்ப முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    badEmail: 'உங்கள் மின்னஞ்சல் முகவரியைச் சரிபார்க்கவும்.',
    didYouMean: 'நீங்கள் குறிப்பிட்டது {email} ஆ?',
    failed: 'ஏதோ தவறு நடந்தது. மீண்டும் முயற்சிக்கவும்.',
    googleFailed: 'Google உள்நுழைவை உறுதிசெய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
    googleLocale: 'ta',
  },
  hi: {
    confirmTitle: 'पहले एक मन्नत माँगिए: पुष्टि कीजिए कि यह आप ही हैं',
    forEmail: (h) => `यह कैप्सूल ${h} के लिए है`,
    wrongAccount: (e, h) => `आप ${e} से साइन इन हैं, लेकिन यह कैप्सूल ${h} के लिए है।`,
    or: 'या',
    continueWithEmail: 'ईमेल से जारी रखें',
    emailLabel: 'आपका ईमेल',
    sendCode: 'कोड भेजें',
    sending: 'भेज रहे हैं…',
    codeSent: (e) => `हमने ${e} पर 6 अंकों का कोड भेजा है। आने में एक मिनट लग सकता है।`,
    codeLabel: '6 अंकों का कोड',
    confirm: 'पुष्टि करें',
    checking: 'जाँच रहे हैं…',
    resendIn: (s) => `${s} सेकंड में नया कोड मँगा सकते हैं`,
    resend: 'नया कोड भेजें',
    otherEmail: 'कोई दूसरा ईमेल इस्तेमाल करें',
    wrongCode: (n) => (n > 0 ? `यह कोड सही नहीं है। ${n} कोशिशें बाकी हैं।` : 'यह कोड अब काम नहीं करेगा। नया कोड मँगाएँ।'),
    expired: 'कोड की समय-सीमा खत्म हो गई। नया कोड मँगाएँ।',
    tooSoon: 'दूसरा कोड मँगाने से पहले थोड़ा रुकें।',
    limit: 'अभी बहुत सारे कोड मँगाए गए हैं। एक घंटे बाद फिर कोशिश करें।',
    notSent: 'कोड नहीं भेज पाए। कृपया फिर से कोशिश करें।',
    badEmail: 'अपना ईमेल पता जाँचें।',
    didYouMean: 'क्या आपका मतलब {email} था?',
    failed: 'कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।',
    googleFailed: 'Google इस साइन-इन की पुष्टि नहीं कर पाया। कृपया फिर से कोशिश करें।',
    googleLocale: 'hi',
  },
  fr: {
    confirmTitle: 'Fais d’abord un vœu : confirme que c’est bien toi',
    forEmail: (h) => `Cette capsule est pour ${h}`,
    wrongAccount: (e, h) => `Tu utilises le compte ${e}, mais cette capsule est pour ${h}.`,
    or: 'ou',
    continueWithEmail: 'Continuer avec l’e-mail',
    emailLabel: 'Ton e-mail',
    sendCode: 'M’envoyer un code',
    sending: 'Envoi…',
    codeSent: (e) => `Nous avons envoyé un code à 6 chiffres à ${e}. Il peut mettre une minute à arriver.`,
    codeLabel: 'Code à 6 chiffres',
    confirm: 'Confirmer',
    checking: 'Vérification…',
    resendIn: (s) => `Nouveau code possible dans ${s} s`,
    resend: 'Envoyer un nouveau code',
    otherEmail: 'Utiliser une autre adresse',
    wrongCode: (n) =>
      n > 0
        ? `Ce code n’est pas le bon. Encore ${n} essai${n > 1 ? 's' : ''}.`
        : 'Ce code n’est plus valable. Demande-en un nouveau.',
    expired: 'Ce code a expiré. Demande-en un nouveau.',
    tooSoon: 'Attends un instant avant de demander un autre code.',
    limit: 'Trop de codes pour le moment. Réessaie dans une heure.',
    notSent: 'Le code n’a pas pu être envoyé. Réessaie.',
    badEmail: 'Vérifie ton adresse e-mail.',
    didYouMean: 'Tu voulais dire {email} ?',
    failed: 'Un problème est survenu. Réessaie.',
    googleFailed: 'Google n’a pas pu confirmer la connexion. Réessaie.',
    googleLocale: 'fr',
  },
  it: {
    confirmTitle: 'Prima esprimi un desiderio: conferma che sei tu',
    forEmail: (h) => `Questa capsula è per ${h}`,
    wrongAccount: (e, h) => `Stai usando l’account ${e}, ma questa capsula è per ${h}.`,
    or: 'oppure',
    continueWithEmail: 'Continua con l’email',
    emailLabel: 'La tua email',
    sendCode: 'Mandami un codice',
    sending: 'Invio…',
    codeSent: (e) => `Abbiamo mandato un codice di 6 cifre a ${e}. Può volerci un minuto.`,
    codeLabel: 'Codice di 6 cifre',
    confirm: 'Conferma',
    checking: 'Verifica…',
    resendIn: (s) => `Puoi chiedere un nuovo codice tra ${s} s`,
    resend: 'Manda un nuovo codice',
    otherEmail: 'Usa un’altra email',
    wrongCode: (n) =>
      n > 0
        ? `Il codice non è giusto. ${n === 1 ? 'Ti resta 1 tentativo' : `Ti restano ${n} tentativi`}.`
        : 'Questo codice non vale più. Chiedine uno nuovo.',
    expired: 'Il codice è scaduto. Chiedine uno nuovo.',
    tooSoon: 'Aspetta un momento prima di chiedere un altro codice.',
    limit: 'Troppi codici per ora. Riprova tra un’ora.',
    notSent: 'Non siamo riusciti a mandare il codice. Riprova.',
    badEmail: 'Controlla il tuo indirizzo email.',
    didYouMean: 'Forse intendevi {email}?',
    failed: 'Qualcosa è andato storto. Riprova.',
    googleFailed: 'Google non ha potuto confermare l’accesso. Riprova.',
    googleLocale: 'it',
  },
  de: {
    confirmTitle: 'Wünsch dir zuerst etwas: Bestätige, dass du es bist',
    forEmail: (h) => `Diese Kapsel ist für ${h}`,
    wrongAccount: (e, h) => `Du bist als ${e} angemeldet, aber diese Kapsel ist für ${h}.`,
    or: 'oder',
    continueWithEmail: 'Mit E-Mail fortfahren',
    emailLabel: 'Deine E-Mail',
    sendCode: 'Code schicken',
    sending: 'Wird gesendet…',
    codeSent: (e) => `Wir haben einen 6-stelligen Code an ${e} geschickt. Es kann eine Minute dauern.`,
    codeLabel: '6-stelliger Code',
    confirm: 'Bestätigen',
    checking: 'Wird geprüft…',
    resendIn: (s) => `Neuer Code in ${s} s möglich`,
    resend: 'Neuen Code schicken',
    otherEmail: 'Andere E-Mail verwenden',
    wrongCode: (n) =>
      n > 0
        ? `Der Code stimmt nicht. Noch ${n} ${n === 1 ? 'Versuch' : 'Versuche'}.`
        : 'Dieser Code gilt nicht mehr. Fordere einen neuen an.',
    expired: 'Der Code ist abgelaufen. Fordere einen neuen an.',
    tooSoon: 'Warte kurz, bevor du einen neuen Code anforderst.',
    limit: 'Gerade zu viele Codes. Versuch es in einer Stunde noch einmal.',
    notSent: 'Der Code konnte nicht gesendet werden. Bitte versuch es noch einmal.',
    badEmail: 'Prüf deine E-Mail-Adresse.',
    didYouMean: 'Meintest du {email}?',
    failed: 'Etwas ist schiefgelaufen. Bitte versuch es noch einmal.',
    googleFailed: 'Google konnte die Anmeldung nicht bestätigen. Bitte versuch es noch einmal.',
    googleLocale: 'de',
  },
}
