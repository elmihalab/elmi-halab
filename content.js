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
    about: 'تُعنى شعبة الشؤون العلمية في مديرية أوقاف حلب بالعمل العلمي في مساجد المدينة: تنظّم الدروس والدورات والبرامج العلمية وتشرف عليها، وتنفّذ الخطط العلمية المعتمدة من وزارة الأوقاف، وتنسّق مع المشايخ والجهات العلمية في المدينة.\nوتجمع هذه الصفحة خدمات الشعبة للأئمة والخطباء والمحاضرين، وهي صلة وصل بين أهل حلب ومساجدهم في كل ما يتعلق بالدروس والنشاطات العلمية.',
    tasks: 'تنفيذ الخطط والبرامج العلمية المعتمدة من وزارة الأوقاف\nتنظيم الدروس والدورات والبرامج العلمية والإشراف عليها\nمتابعة المواد والخطط العلمية مع الأئمة والخطباء ومعاونتهم على تطبيقها\nالتنسيق مع المشايخ والجهات العلمية في المدينة\nرصد الواقع العلمي في المساجد ورفع التقارير عنه\nإجراء الاختبارات العلمية للمتقدمين إلى الوظائف المسجدية',
    whatsapp_channel: 'https://www.whatsapp.com/channel/0029Vb7F8jREKyZPQP4L4A2y',
    contact_phone: '',
    version: '1.0'
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
    { id: 'd-sec-1', title: 'دورة فقه الخلاف', kicker: 'الدورات العلمية', description: 'المواد العلمية للدورة وكل ما يخصها، وملخص مركّز لمن أراد الخلاصة.', sort: 10, visible: true },
    { id: 'd-sec-2', title: 'إصدارات الشعبة', kicker: 'الإصدارات', description: '', sort: 20, visible: true },
    { id: 'd-sec-3', title: 'المجالس العلمية', kicker: 'المجالس', description: '', sort: 30, visible: true },
    { id: 'd-sec-4', title: 'الخدمات والنماذج', kicker: 'للأئمة والمحاضرين', description: '', sort: 40, visible: true },
    { id: 'd-sec-5', title: 'خطب الجمعة', kicker: 'المكتبة', description: '', sort: 50, visible: true },
    { id: 'd-sec-6', title: 'تابعونا', kicker: 'التواصل', description: '', sort: 60, visible: true }
  ],

  items: [
    { id: 'd-it-1', section_id: 'd-sec-1', title: 'المادة العلمية للدورة', description: 'المادة الكاملة لدورة فقه الخلاف', url: '', file_url: '', file_name: '', icon: 'graduation-cap', badge: 'قريبًا', sort: 10, visible: true },
    { id: 'd-it-2', section_id: 'd-sec-1', title: 'ملخص الملخص', description: 'خلاصة الدورة في صفحات قليلة', url: '', file_url: '', file_name: '', icon: 'notebook-pen', badge: 'قريبًا', sort: 20, visible: true },

    { id: 'd-it-3', section_id: 'd-sec-2', title: 'مصنَّف أسماء الله الحسنى', description: 'مادة إيمانية للتدريس في المساجد', url: '', file_url: '', file_name: '', icon: 'book-marked', badge: 'قريبًا', sort: 10, visible: true },

    { id: 'd-it-4', section_id: 'd-sec-3', title: 'مجلس سماع صحيح البخاري', description: 'التسجيل والحضور والشهادات والتحقق منها', url: 'https://majlis-albukhari.vercel.app/', file_url: '', file_name: '', icon: 'book-open', badge: '', sort: 10, visible: true },

    { id: 'd-it-5', section_id: 'd-sec-4', title: 'طلب إذن نشاط علمي', description: 'نموذج طلب إذن لدرس أو دورة أو نشاط علمي في مسجد', url: 'https://docs.google.com/forms/d/e/1FAIpQLSeGv2XMq6JrHC2tkCN8G-q1dL7SUPEXoV-WcRCrN0MDqGO-Nw/viewform', file_url: '', file_name: '', icon: 'file-check', badge: '', sort: 10, visible: true },
    { id: 'd-it-6', section_id: 'd-sec-4', title: 'بيانات المحاضرين', description: 'سجّل سيرتك العلمية إن كنت تلقي دروسًا في مساجد حلب', url: 'https://docs.google.com/forms/d/e/1FAIpQLSf6q75zhkG_onivlrb62FrXdmaOnf7YX8lXb2JjYQJVdPmgsA/viewform', file_url: '', file_name: '', icon: 'pen-line', badge: '', sort: 20, visible: true },
    { id: 'd-it-7', section_id: 'd-sec-4', title: 'سجل علماء ومشايخ حلب', description: 'اقترح عالمًا أو شيخًا لإدراجه في السجل', url: 'https://docs.google.com/forms/d/e/1FAIpQLScqMigcBw4Fl8nquudoUeOjEH30fcGTE9_6lLV_Xr6DUK9_3w/viewform', file_url: '', file_name: '', icon: 'users', badge: '', sort: 30, visible: true },

    { id: 'd-it-8', section_id: 'd-sec-5', title: 'مكتبة خطب الجمعة', description: 'خطب الوزارة والشعبة في مكان واحد', url: 'https://padlet.com/elmihalab/padlet-r5zsfzkhgsnv0wzx', file_url: '', file_name: '', icon: 'scroll-text', badge: '', sort: 10, visible: true },

    { id: 'd-it-9', section_id: 'd-sec-6', title: 'قناة الشعبة على واتساب', description: 'أخبار الدروس والدورات أولًا بأول', url: 'https://www.whatsapp.com/channel/0029Vb7F8jREKyZPQP4L4A2y', file_url: '', file_name: '', icon: 'whatsapp', badge: '', sort: 10, visible: true },
    { id: 'd-it-10', section_id: 'd-sec-6', title: 'وزارة الأوقاف', description: 'الصفحة الرسمية على فيسبوك', url: 'https://www.facebook.com/SyMOfE', file_url: '', file_name: '', icon: 'facebook', badge: '', sort: 20, visible: true },
    { id: 'd-it-11', section_id: 'd-sec-6', title: 'مديرية أوقاف حلب', description: 'الصفحة الرسمية على فيسبوك', url: 'https://www.facebook.com/Awqaf.Aleppo', file_url: '', file_name: '', icon: 'facebook', badge: '', sort: 30, visible: true }
  ]
};
