/* ============================================================
   المحتوى الأساسي للموقع
   ------------------------------------------------------------
   يظهر هذا المحتوى في الموقع ما دام Supabase غير مربوط بعد.
   وبعد الربط يُنقل إلى قاعدة البيانات بزر واحد من لوحة الإدارة
   («استيراد المحتوى الأساسي»)، ومن بعدها يُعدَّل كل شيء من اللوحة.
   ============================================================ */

window.DEFAULT_CONTENT = {

  settings: {
    site_title: 'شعبة الشؤون العلمية',
    org_name: 'مديرية أوقاف حلب',
    tagline: 'تنظيم الدروس والدورات والبرامج العلمية في مساجد حلب وتطويرها',
    about: 'تُعنى شعبة الشؤون العلمية في حلب بالعمل العلمي في مساجد المدينة: تنظّم الدروس والدورات والبرامج العلمية وتشرف عليها، وتنفّذ الخطط العلمية المعتمدة من وزارة الأوقاف، وتنسّق مع المشايخ والجهات العلمية في المدينة.\nوتجمع هذه الصفحة خدمات الشعبة للأئمة والخطباء والمحاضرين، وهي صلة وصل بين أهل حلب ومساجدهم في كل ما يتعلق بالدروس والنشاطات العلمية.',
    tasks: 'تنفيذ الخطط والبرامج العلمية المعتمدة من وزارة الأوقاف\nتنظيم الدروس والدورات والبرامج العلمية والإشراف عليها\nمتابعة المواد والخطط العلمية مع الأئمة والخطباء ومعاونتهم على تطبيقها\nالتنسيق مع المشايخ والجهات العلمية في المدينة\nرصد الواقع العلمي في المساجد ورفع التقارير عنه',
    whatsapp_channel: 'https://www.whatsapp.com/channel/0029Vb7F8jREKyZPQP4L4A2y',
    whatsapp_contact: 'https://wa.me/message/ZOI2GZURI6OEN1',
    contact_phone: '',
    version: '2.1',

    // رأس الصفحة: نقاط تحت السطر التعريفي، وزر رئيسي
    hero_points: 'طلب إذن الدروس والنشاطات العلمية في مساجد حلب\nاللقاء التطويري الشهري للأئمة والخطباء\nالدورات والإصدارات العلمية ومواد الدروس',
    cta_label: 'طلب إذن درس',
    cta_url: 'https://surveys.system.mow.gov.sy/client-surveys/mrLp66af03061ef0d7',

    // «كيف تستفيد من الشعبة؟» — كل خطوة في سطر: العنوان :: الوصف
    steps: 'اطلب الإذن :: املأ نموذج «طلب إذن درس» قبل أن تبدأ درسًا أو دورة في مسجدك.\nسجّل درسك :: أضف درسك القائم إلى دليل الدروس، ليصل إليه طلابه من كل أحياء حلب.\nاحضر اللقاء الشهري :: لقاء تطويري عن بُعد للأئمة والخطباء كل شهر، فيه محاضرة وحوار.\nتابع القناة :: اشترك في قناة الشعبة على واتساب، فتصلك الدورات والإعلانات أولًا.',

    // الأسئلة الشائعة — كل سؤال في سطر: السؤال :: الجواب
    faq: 'كيف أطلب إذنًا لدرس أو دورة في مسجدي؟ :: من قسم «الخدمات» أعلى الصفحة: افتح «طلب إذن درس» واملأ النموذج.\nمتى يُعقد اللقاء التطويري الشهري؟ :: مرة كل شهر عن بُعد، ويُعلَن موعده ورابط الدخول في هذه الصفحة وفي قناة الشعبة على واتساب.\nأين أجد كتب الشعبة وإصداراتها؟ :: في قسم «إصدارات الشعبة»، وتُفتح الملفات وتُنزَّل مباشرة.\nكيف أضيف مسجدي ومعلوماته؟ :: من تطبيق «مسجدك» التابع لوزارة الأوقاف، ورابطه في قسم «الدروس العلمية في حلب».\nهل مواقيت الصلاة أعلى الصفحة رسمية؟ :: نعم، هي من تقويم وزارة الأوقاف لكل مناطق سورية. اضغط اسم المدينة لتختار مدينتك.\nكيف أتواصل مع الشعبة؟ :: راسلها على واتساب من زر «مراسلة الشعبة»، أو اشترك في قناتها لتصلك الأخبار.',

    // روابط التذييل — كل رابط في سطر: العنوان :: الرابط
    footer_links: 'تطبيق «مسجدك» :: https://masjidak.mow.gov.sy/ar | https://play.google.com/store/apps/details?id=mobile.masjidak.app | https://apps.apple.com/us/app/masjidak-your-mosques-way/id6768942028\nوزارة الأوقاف :: https://www.facebook.com/SyMOfE\nمديرية أوقاف حلب :: https://www.facebook.com/Awqaf.Aleppo\nأطلس سوريا للصلاة :: https://syria-prayer-atlas.vercel.app/'
  },

  meetings: [
    {
      id: 'd-meet-1',
      number: 1,
      title: 'المسجد.. رسالةٌ وأثر',
      meeting_date: '2026-10-30',
      meeting_time: '20:30',
      duration: 'ساعة ونصف',
      axes: 'عِظم رسالة المسجد وأثره في حياة الناس\nاستثمار أنشطة المسجد: الدروس والحلقات\nالنشاط المجتمعي للمسجد\nحوار مفتوح مع الأئمة والخطباء',
      guests: '',
      lecturer: '',
      join_url: '',
      form_url: '',
      recording_url: '',
      recommendations: '',
      visible: true
    }
  ],

  sections: [
    { id: 'd-sec-4', title: 'الخدمات', kicker: 'للأئمة والمحاضرين', description: '', sort: 5, visible: true },
    { id: 'd-sec-10', title: 'مصحف الشهباء', kicker: 'القرآن الكريم', description: 'مصحف المدينة النبوية بخط مجمع الملك فهد، من شعبة الشؤون العلمية في حلب.', sort: 6, visible: true },
    { id: 'd-sec-9', title: 'الأذكار', kicker: 'كل يوم', description: 'أذكار الصباح والمساء وما بعد الصلاة، بعدّاد ينتقل بين الأذكار وحده.', sort: 7, visible: true },
    { id: 'd-sec-7', title: 'الدروس العلمية في حلب', kicker: 'الدروس', description: 'دليلٌ للدروس القائمة في مساجد حلب، يُبنى من تسجيل الأئمة والمدرّسين لدروسهم.', sort: 8, visible: true },
    { id: 'd-sec-8', title: 'الدورات التخصصية', kicker: 'قريبًا بإذن الله', description: 'برامج علمية متدرجة تُفتح تباعًا، ويُعلن عن كل برنامج هنا وفي قناة الشعبة.', sort: 12, visible: true },
    { id: 'd-sec-2', title: 'إصدارات الشعبة', kicker: 'الإصدارات', description: '', sort: 20, visible: true },
    { id: 'd-sec-3', title: 'المجالس العلمية', kicker: 'المجالس', description: '', sort: 30, visible: true },
    { id: 'd-sec-5', title: 'خطب الجمعة', kicker: 'المكتبة', description: '', sort: 50, visible: true }
  ],

  items: [
    // الخدمات
    { id: 'd-it-5', section_id: 'd-sec-4', title: 'طلب إذن درس', description: 'لإلقاء درس أو دورة أو نشاط علمي في أحد مساجد حلب', url: 'https://surveys.system.mow.gov.sy/client-surveys/mrLp66af03061ef0d7', file_url: '', file_name: '', icon: 'file-check', badge: '', sort: 10, visible: true },
    { id: 'd-it-6', section_id: 'd-sec-4', title: 'بيانات المحاضرين', description: 'سجّل سيرتك العلمية إن كنت تلقي دروسًا في مساجد حلب', url: 'https://surveys.system.mow.gov.sy/client-surveys/kbHCq6af05b2102362', file_url: '', file_name: '', icon: 'pen-line', badge: '', sort: 20, visible: true },
    { id: 'd-it-7', section_id: 'd-sec-4', title: 'سجل علماء ومشايخ حلب', description: 'اقترح عالمًا أو شيخًا لإدراجه في السجل', url: 'https://surveys.system.mow.gov.sy/client-surveys/conTJ6af2f69e14bca', file_url: '', file_name: '', icon: 'users', badge: '', sort: 30, visible: true },
    { id: 'd-it-16', section_id: 'd-sec-4', title: 'مراسلة الشعبة على واتساب', description: 'لكل سؤال أو اقتراح أو طلب', url: 'https://wa.me/message/ZOI2GZURI6OEN1', file_url: '', file_name: '', icon: 'whatsapp', badge: '', sort: 40, visible: true },

    // مصحف الشهباء
    { id: 'd-it-45', section_id: 'd-sec-10', title: 'مصحف الشهباء', description: 'تقليب وتمرير، وبحث بالكلمة أو برقم السورة والآية، ويعمل دون إنترنت', url: 'https://mushaf-elmi-halab.vercel.app/', file_url: '', file_name: '', icon: 'book-open', badge: 'جديد', sort: 10, visible: true },

    // الأذكار
    { id: 'd-it-40', section_id: 'd-sec-9', title: 'أذكار الصباح', description: 'من طلوع الفجر، والأفضل قبل طلوع الشمس', url: 'adhkar.html#sabah', file_url: '', file_name: '', icon: 'sun', badge: '', sort: 10, visible: true },
    { id: 'd-it-41', section_id: 'd-sec-9', title: 'أذكار المساء', description: 'من بعد العصر إلى غروب الشمس', url: 'adhkar.html#masa', file_url: '', file_name: '', icon: 'moon', badge: '', sort: 20, visible: true },
    { id: 'd-it-42', section_id: 'd-sec-9', title: 'أذكار بعد الصلاة', description: 'الاستغفار والتسبيح وآية الكرسي والمعوذات', url: 'adhkar.html#salah', file_url: '', file_name: '', icon: 'sparkles', badge: '', sort: 30, visible: true },
    { id: 'd-it-46', section_id: 'd-sec-9', title: 'كل الأذكار', description: 'أذكار الاستيقاظ والوضوء والمسجد والصلاة والنوم وغيرها', url: 'adhkar.html#all', file_url: '', file_name: '', icon: 'book-open', badge: 'جديد', sort: 40, visible: true },

    // الدروس العلمية في حلب
    { id: 'd-it-12', section_id: 'd-sec-7', title: 'الدروس العلمية القائمة الآن', description: 'الدرس والشيخ والموعد، والمسجد على الخريطة', url: '', file_url: '', file_name: '', icon: 'map-pin', badge: 'قريبًا', sort: 10, visible: true },
    { id: 'd-it-13', section_id: 'd-sec-7', title: 'سجّل درسك', description: 'للأئمة والمدرّسين: سجّل درسك القائم ليظهر في الدليل', url: '', file_url: '', file_name: '', icon: 'calendar-days', badge: 'قريبًا', sort: 20, visible: true },
    // رابط واحد يختار المتجر المناسب: الموقع للحاسوب، Google Play للأندرويد، App Store للآيفون
    { id: 'd-it-14', section_id: 'd-sec-7', title: 'أضف مسجدك في تطبيق «مسجدك»', description: 'تطبيق وزارة الأوقاف للمساجد: أضف موقع مسجدك ومعلوماته، وتابع دروسه وأنشطته', url: 'https://masjidak.mow.gov.sy/ar | https://play.google.com/store/apps/details?id=mobile.masjidak.app | https://apps.apple.com/us/app/masjidak-your-mosques-way/id6768942028', file_url: '', file_name: '', icon: 'landmark', badge: '', sort: 30, visible: true },


    // الدورات التخصصية
    { id: 'd-it-20', section_id: 'd-sec-8', title: '«مفاتيح الطلب» — الدورة المكثفة', description: 'لطلبة العلم والأئمة الشباب — ٧ أيام، ٢٨ مجلسًا', url: '', file_url: '', file_name: '', icon: 'sparkles', badge: 'قريبًا', sort: 10, visible: true },
    { id: 'd-it-21', section_id: 'd-sec-8', title: '«مدارج الطلب» — السلّم المتدرج', description: 'لطلبة العلم الملتزمين — ٣ مستويات، كل مستوى ١٢ أسبوعًا', url: '', file_url: '', file_name: '', icon: 'graduation-cap', badge: 'قريبًا', sort: 20, visible: true },
    { id: 'd-it-22', section_id: 'd-sec-8', title: 'السلالم المذهبية الأربعة', description: 'لطلبة العلم والأئمة، كلٌّ في مذهبه — ٤ درجات متصاعدة', url: '', file_url: '', file_name: '', icon: 'book-open', badge: 'قريبًا', sort: 30, visible: true },
    { id: 'd-it-23', section_id: 'd-sec-8', title: 'كراسي المذاهب الأربعة', description: 'للمتقدمين ومستمعين من العموم — مجلس أسبوعي دائم لكل كرسي', url: '', file_url: '', file_name: '', icon: 'landmark', badge: 'قريبًا', sort: 40, visible: true },
    { id: 'd-it-24', section_id: 'd-sec-8', title: 'الدورة الصيفية التأصيلية', description: 'للشباب وطلاب الجامعات — أسبوعان، ٢٨ مجلسًا', url: '', file_url: '', file_name: '', icon: 'calendar-days', badge: 'قريبًا', sort: 50, visible: true },
    { id: 'd-it-25', section_id: 'd-sec-8', title: 'محو الأمية الشرعية', description: 'للمؤذنين والخدام — ٨ أسابيع، ١٦ لقاءً', url: '', file_url: '', file_name: '', icon: 'pen-line', badge: 'قريبًا', sort: 60, visible: true },
    { id: 'd-it-26', section_id: 'd-sec-8', title: 'دورة فقه الخلاف', description: 'للخطباء — ٤ أيام، ٢٠ ساعة', url: '', file_url: 'files/fiqh-alkhilaf.pdf', file_name: 'fiqh-alkhilaf.pdf', icon: 'users', badge: 'المنهج مكتمل', sort: 70, visible: true },
    { id: 'd-it-27', section_id: 'd-sec-8', title: 'رفع المستوى العلمي', description: 'للأئمة والخطباء — لقاء شهري، ١٠ لقاءات في السنة', url: '#meeting', file_url: '', file_name: '', icon: 'mic', badge: 'انطلق', sort: 80, visible: true },
    { id: 'd-it-28', section_id: 'd-sec-8', title: 'التحقيق والمكتبات الوقفية', description: 'للباحثين وأمناء المكتبات — ١٠ مجالس وتطبيق على مخطوط', url: '', file_url: '', file_name: '', icon: 'library', badge: 'قريبًا', sort: 90, visible: true },
    { id: 'd-it-30', section_id: 'd-sec-8', title: 'الدورات عن بُعد', description: 'لأهل الريف والنساء ومن لا يستطيع الحضور — مسار دائم موازٍ', url: '', file_url: '', file_name: '', icon: 'video', badge: 'قريبًا', sort: 110, visible: true },

    // الإصدارات
    { id: 'd-it-3', section_id: 'd-sec-2', title: 'أسماء الله الحسنى: مجالس إيمانية في معرفة الله بأسمائه الحسنى', description: 'عشرة مجالس للتدريس في المساجد', url: '', file_url: 'files/asma-allah-alhusna.pdf', file_name: 'asma-allah-alhusna.pdf', icon: 'book-marked', badge: '', sort: 10, visible: true },
    { id: 'd-it-1', section_id: 'd-sec-2', title: 'فقه الخلاف: من فهم الاختلاف إلى العمل المشترك — مختصر المختصر', description: 'نسخة المتدرّب: خلاصة الكتاب في فصوله التسعة عشر، للخطيب', url: '', file_url: 'files/fiqh-alkhilaf.pdf', file_name: 'fiqh-alkhilaf.pdf', icon: 'book-open', badge: 'جديد', sort: 20, visible: true },

    // المجالس
    { id: 'd-it-4', section_id: 'd-sec-3', title: 'مجلس سماع صحيح البخاري', description: 'التسجيل والحضور والشهادات والتحقق منها', url: 'https://majlis-albukhari.vercel.app/', file_url: '', file_name: '', icon: 'book-open', badge: '', sort: 10, visible: true },

    // خطب الجمعة
    { id: 'd-it-8', section_id: 'd-sec-5', title: 'مكتبة خطب الجمعة', description: 'خطب الوزارة والشعبة في مكان واحد', url: 'https://padlet.com/elmihalab/padlet-r5zsfzkhgsnv0wzx', file_url: '', file_name: '', icon: 'scroll-text', badge: '', sort: 10, visible: true }
  ]
};
