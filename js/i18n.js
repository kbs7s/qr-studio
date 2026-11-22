/* QR Studio — Arabic / English strings and language switching. */
(function () {
  'use strict';

  var STRINGS = {
    en: {
      appName: 'QR Studio',
      tagline: 'Make and read QR codes, even offline',
      tabCreate: 'Create',
      tabScan: 'Scan',
      langSwitch: 'العربية',
      install: 'Install app',
      iosInstall: 'To install: tap Share, then “Add to Home Screen”.',
      offlineReady: 'Ready to work offline',
      updateReady: 'A new version is ready. Reload to update.',
      reload: 'Reload',

      // types
      typeUrl: 'Link',
      typeText: 'Text',
      typeWifi: 'Wi‑Fi',
      typeContact: 'Contact',
      typeEmail: 'Email',
      typeSms: 'SMS',
      typePhone: 'Phone',
      typeGeo: 'Location',

      // fields
      url: 'Website address',
      text: 'Text',
      textPh: 'Type anything…',
      ssid: 'Network name (SSID)',
      password: 'Password',
      security: 'Security',
      secWpa: 'WPA / WPA2 / WPA3',
      secWep: 'WEP',
      secNone: 'No password',
      hidden: 'Hidden network',
      showPassword: 'Show password',
      firstName: 'First name',
      lastName: 'Last name',
      phone: 'Phone',
      email: 'Email',
      org: 'Company',
      jobTitle: 'Job title',
      website: 'Website',
      address: 'Address',
      note: 'Note',
      to: 'To',
      subject: 'Subject',
      body: 'Message',
      number: 'Phone number',
      message: 'Message',
      lat: 'Latitude',
      lng: 'Longitude',
      placeLabel: 'Place name (optional)',
      useMyLocation: 'Use my location',
      locating: 'Finding your location…',
      locationFailed: 'Could not get your location.',

      // style
      style: 'Style',
      colors: 'Colors',
      fg: 'Dots',
      bg: 'Background',
      cornerColor: 'Corners',
      gradient: 'Gradient',
      gradientColor: 'Second color',
      transparentBg: 'Transparent background',
      dotShape: 'Dot shape',
      cornerShape: 'Corner shape',
      cornerDotShape: 'Corner center',
      shapeSquare: 'Square',
      shapeDots: 'Dots',
      shapeRounded: 'Rounded',
      shapeExtraRounded: 'Extra rounded',
      shapeClassy: 'Classy',
      shapeClassyRounded: 'Classy rounded',
      shapeDot: 'Circle',
      logo: 'Logo',
      addLogo: 'Add logo',
      removeLogo: 'Remove',
      logoSize: 'Logo size',
      logoClear: 'Clear dots behind logo',
      errorLevel: 'Error correction',
      ecL: 'Low (7%)',
      ecM: 'Medium (15%)',
      ecQ: 'High (25%)',
      ecH: 'Highest (30%)',
      ecHint: 'Higher levels survive damage and logos better, but make denser codes.',
      margin: 'Quiet zone',
      presets: 'Quick looks',
      reset: 'Reset style',

      // output
      download: 'Download PNG',
      share: 'Share',
      copyText: 'Copy content',
      copied: 'Copied',
      emptyHint: 'Fill in the form to see your QR code.',
      tooLong: 'Too much content for one QR code. Shorten it and try again.',
      qrInfo: 'Version {v} · {n}×{n} modules · {c} characters',
      lowContrast: 'Low contrast: some phones may fail to read this. Use darker dots on a lighter background.',

      // scan
      startCamera: 'Start camera',
      stopCamera: 'Stop camera',
      camera: 'Camera',
      scanImage: 'Scan an image',
      dropHint: 'Choose a photo or screenshot, drop it here, or paste it.',
      scanning: 'Point the camera at a QR code',
      noCamera: 'No camera found on this device.',
      cameraDenied: 'Camera access was blocked. Allow camera access in your browser settings and try again.',
      cameraInsecure: 'The camera only works when the app is opened over https (or installed). Scanning images still works.',
      cameraError: 'Could not start the camera.',
      notFound: 'No QR code was found in this image.',
      reading: 'Reading image…',
      result: 'Result',
      scanAgain: 'Scan again',
      rawContent: 'Raw content',
      openLink: 'Open link',
      linkWarning: 'Check the address before opening it.',
      callNumber: 'Call',
      sendSms: 'Send SMS',
      sendEmail: 'Write email',
      openMap: 'Open in maps',
      saveContact: 'Save contact',
      copyPassword: 'Copy password',
      network: 'Network',
      format: 'Format',
      history: 'Recent scans',
      clearHistory: 'Clear',
      noHistory: 'Nothing scanned yet.',
      kindUrl: 'Link',
      kindText: 'Text',
      kindWifi: 'Wi‑Fi network',
      kindContact: 'Contact',
      kindEmail: 'Email',
      kindSms: 'SMS',
      kindPhone: 'Phone number',
      kindGeo: 'Location',
      yes: 'Yes',
      no: 'No',
      footer: 'Everything runs on your device. Nothing is uploaded.'
    },

    ar: {
      appName: 'استوديو QR',
      tagline: 'أنشئ رموز QR واقرأها، حتى بدون إنترنت',
      tabCreate: 'إنشاء',
      tabScan: 'مسح',
      langSwitch: 'English',
      install: 'تثبيت التطبيق',
      iosInstall: 'للتثبيت: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».',
      offlineReady: 'جاهز للعمل بدون إنترنت',
      updateReady: 'يتوفر إصدار جديد. أعد التحميل للتحديث.',
      reload: 'إعادة التحميل',

      typeUrl: 'رابط',
      typeText: 'نص',
      typeWifi: 'واي فاي',
      typeContact: 'جهة اتصال',
      typeEmail: 'بريد إلكتروني',
      typeSms: 'رسالة SMS',
      typePhone: 'هاتف',
      typeGeo: 'موقع',

      url: 'عنوان الموقع',
      text: 'النص',
      textPh: 'اكتب أي شيء…',
      ssid: 'اسم الشبكة (SSID)',
      password: 'كلمة المرور',
      security: 'نوع الحماية',
      secWpa: 'WPA / WPA2 / WPA3',
      secWep: 'WEP',
      secNone: 'بدون كلمة مرور',
      hidden: 'شبكة مخفية',
      showPassword: 'إظهار كلمة المرور',
      firstName: 'الاسم الأول',
      lastName: 'اسم العائلة',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      org: 'الشركة',
      jobTitle: 'المسمى الوظيفي',
      website: 'الموقع الإلكتروني',
      address: 'العنوان',
      note: 'ملاحظة',
      to: 'إلى',
      subject: 'الموضوع',
      body: 'الرسالة',
      number: 'رقم الهاتف',
      message: 'الرسالة',
      lat: 'خط العرض',
      lng: 'خط الطول',
      placeLabel: 'اسم المكان (اختياري)',
      useMyLocation: 'استخدم موقعي',
      locating: 'جارٍ تحديد موقعك…',
      locationFailed: 'تعذّر الحصول على موقعك.',

      style: 'التصميم',
      colors: 'الألوان',
      fg: 'النقاط',
      bg: 'الخلفية',
      cornerColor: 'الزوايا',
      gradient: 'تدرّج لوني',
      gradientColor: 'اللون الثاني',
      transparentBg: 'خلفية شفافة',
      dotShape: 'شكل النقاط',
      cornerShape: 'شكل الزوايا',
      cornerDotShape: 'مركز الزوايا',
      shapeSquare: 'مربّع',
      shapeDots: 'نقاط',
      shapeRounded: 'مستدير',
      shapeExtraRounded: 'مستدير جداً',
      shapeClassy: 'أنيق',
      shapeClassyRounded: 'أنيق مستدير',
      shapeDot: 'دائرة',
      logo: 'الشعار',
      addLogo: 'إضافة شعار',
      removeLogo: 'إزالة',
      logoSize: 'حجم الشعار',
      logoClear: 'إخفاء النقاط خلف الشعار',
      errorLevel: 'تصحيح الأخطاء',
      ecL: 'منخفض (7٪)',
      ecM: 'متوسط (15٪)',
      ecQ: 'عالٍ (25٪)',
      ecH: 'الأعلى (30٪)',
      ecHint: 'المستويات الأعلى تتحمّل التلف والشعارات بشكل أفضل، لكنها تجعل الرمز أكثر كثافة.',
      margin: 'الهامش',
      presets: 'أشكال جاهزة',
      reset: 'إعادة التصميم',

      download: 'تنزيل PNG',
      share: 'مشاركة',
      copyText: 'نسخ المحتوى',
      copied: 'تم النسخ',
      emptyHint: 'املأ النموذج لترى رمز QR.',
      tooLong: 'المحتوى أطول من أن يتّسع له رمز واحد. اختصره وحاول مرة أخرى.',
      qrInfo: 'الإصدار {v} · {n}×{n} وحدة · {c} حرفاً',
      lowContrast: 'التباين منخفض: قد تفشل بعض الهواتف في قراءته. استخدم نقاطاً داكنة على خلفية فاتحة.',

      startCamera: 'تشغيل الكاميرا',
      stopCamera: 'إيقاف الكاميرا',
      camera: 'الكاميرا',
      scanImage: 'مسح صورة',
      dropHint: 'اختر صورة أو لقطة شاشة، أو اسحبها إلى هنا، أو الصقها.',
      scanning: 'وجّه الكاميرا نحو رمز QR',
      noCamera: 'لم يتم العثور على كاميرا في هذا الجهاز.',
      cameraDenied: 'تم حظر الوصول إلى الكاميرا. اسمح به من إعدادات المتصفح ثم حاول مرة أخرى.',
      cameraInsecure: 'تعمل الكاميرا فقط عند فتح التطبيق عبر https (أو بعد تثبيته). ما زال مسح الصور يعمل.',
      cameraError: 'تعذّر تشغيل الكاميرا.',
      notFound: 'لم يتم العثور على رمز QR في هذه الصورة.',
      reading: 'جارٍ قراءة الصورة…',
      result: 'النتيجة',
      scanAgain: 'مسح مرة أخرى',
      rawContent: 'المحتوى الأصلي',
      openLink: 'فتح الرابط',
      linkWarning: 'تحقّق من العنوان قبل فتحه.',
      callNumber: 'اتصال',
      sendSms: 'إرسال رسالة',
      sendEmail: 'كتابة بريد',
      openMap: 'فتح في الخرائط',
      saveContact: 'حفظ جهة الاتصال',
      copyPassword: 'نسخ كلمة المرور',
      network: 'الشبكة',
      format: 'النوع',
      history: 'آخر عمليات المسح',
      clearHistory: 'مسح',
      noHistory: 'لم يتم مسح أي شيء بعد.',
      kindUrl: 'رابط',
      kindText: 'نص',
      kindWifi: 'شبكة واي فاي',
      kindContact: 'جهة اتصال',
      kindEmail: 'بريد إلكتروني',
      kindSms: 'رسالة SMS',
      kindPhone: 'رقم هاتف',
      kindGeo: 'موقع',
      yes: 'نعم',
      no: 'لا',
      footer: 'كل شيء يعمل على جهازك. لا يتم رفع أي بيانات.'
    }
  };

  var LANG_KEY = 'qrstudio.lang';

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { /* storage unavailable: ignore */ }
    return null;
  }

  function detect() {
    var saved = store(LANG_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
    var langs = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < langs.length; i++) {
      if (/^ar\b/i.test(langs[i])) return 'ar';
      if (/^en\b/i.test(langs[i])) return 'en';
    }
    return 'en';
  }

  var current = detect();
  var listeners = [];

  function t(key, vars) {
    var s = (STRINGS[current] && STRINGS[current][key]) || STRINGS.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  function apply(root) {
    root = root || document;
    var html = document.documentElement;
    html.lang = current;
    html.dir = current === 'ar' ? 'rtl' : 'ltr';
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    root.querySelectorAll('[data-i18n-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-label')));
    });
    document.title = t('appName');
  }

  function setLang(lang) {
    current = lang === 'ar' ? 'ar' : 'en';
    store(LANG_KEY, current);
    apply();
    listeners.forEach(function (fn) { fn(current); });
  }

  window.I18N = {
    t: t,
    apply: apply,
    get lang() { return current; },
    set: setLang,
    toggle: function () { setLang(current === 'ar' ? 'en' : 'ar'); },
    onChange: function (fn) { listeners.push(fn); }
  };
})();
