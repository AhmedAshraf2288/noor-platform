// Seed: admin account, 4 courses with sample lessons, payment settings.
// Run: npm run seed
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');

const adminEmail = process.env.ADMIN_EMAIL || 'admin@noor.com';
const adminPass = process.env.ADMIN_PASSWORD || 'Admin1234';

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!existing) {
  db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)')
    .run('الأدمن', adminEmail, bcrypt.hashSync(adminPass, config.bcryptRounds), 'admin');
  console.log('admin created:', adminEmail);
} else {
  console.log('admin exists:', adminEmail);
}

const courses = [
  {
    titleAr: 'كورس أساسيات البرمجة - بايثون', titleEn: 'Python Programming Basics',
    descAr: 'ابدأ أول فصل في البرمجة وافهمه من البداية للنهاية بشكل مترابط، مع شرح كل جزئية وتدريب مستمر يساعدك تثبت المعلومة وتكون مستعد لأي سؤال.',
    descEn: 'Start your first chapter in programming and understand it from start to finish, with clear explanation and continuous practice.',
    price: '200.00', icon: 'code', theme: 'cv1',
    lessons: [
      ['مقدمة عن الكورس وإعداد الأدوات', 'Intro & setup', '12 دقيقة'],
      ['أول خطوة: الأساسيات', 'First steps: the basics', '25 دقيقة'],
      ['المتغيرات وأنواع البيانات', 'Variables & data types', '31 دقيقة'],
      ['الشروط والحلقات التكرارية', 'Conditions & loops', '28 دقيقة'],
      ['الدوال والمشاريع العملية', 'Functions & practical projects', '40 دقيقة'],
    ],
  },
  {
    titleAr: 'كورس الإنجليزية من الصفر', titleEn: 'English from Zero',
    descAr: 'ادرس اللغة الإنجليزية خطوة بخطوة من الحروف حتى المحادثة، مع تدريبات مستمرة واختبارات بعد كل جزئية تثبت مستواك.',
    descEn: 'Learn English step by step from letters to conversation, with continuous practice and quizzes after each part.',
    price: '150.00', icon: 'chat', theme: 'cv2',
    lessons: [
      ['الحروف والنطق الصحيح', 'Letters & pronunciation', '20 دقيقة'],
      ['القواعد الأساسية ببساطة', 'Basic grammar made simple', '30 دقيقة'],
      ['محادثات يومية واقعية', 'Real daily conversations', '26 دقيقة'],
    ],
  },
  {
    titleAr: 'كورس تصميم الواجهات UI/UX', titleEn: 'UI/UX Design',
    descAr: 'من أساسيات التصميم حتى بناء واجهات احترافية كاملة، بشرح مبسط وتطبيق عملي على كل درس مع مراجعة مستمرة.',
    descEn: 'From design basics to building full professional interfaces, with simple explanation and hands-on practice in every lesson.',
    price: '100.00', icon: 'palette', theme: 'cv3',
    lessons: [
      ['مبادئ التصميم والألوان', 'Design & color principles', '22 دقيقة'],
      ['أساسيات تجربة المستخدم', 'UX basics', '27 دقيقة'],
      ['التعامل مع فيجما باحتراف', 'Mastering Figma', '35 دقيقة'],
      ['مشروع التخرج', 'Graduation project', '45 دقيقة'],
    ],
  },
  {
    titleAr: 'كورس تطوير الويب المتقدم', titleEn: 'Advanced Web Development',
    descAr: 'اتعلم بناء مواقع كاملة بأحدث التقنيات، من الصفحات البسيطة حتى التطبيقات التفاعلية الكبيرة.',
    descEn: 'Learn to build complete websites with the latest technologies, from simple pages to large interactive apps.',
    price: '250.00', icon: 'atom', theme: 'cv1',
    lessons: [
      ['أساسيات HTML و CSS', 'HTML & CSS basics', '30 دقيقة'],
      ['جافاسكريبت من الصفر', 'JavaScript from zero', '38 دقيقة'],
      ['بناء واجهات تفاعلية', 'Building interactive UIs', '42 دقيقة'],
    ],
  },
];

const hasCourses = db.prepare('SELECT COUNT(*) AS n FROM courses').get().n;
if (hasCourses === 0) {
  const insC = db.prepare('INSERT INTO courses (title_ar, title_en, desc_ar, desc_en, price, icon, theme, published) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
  const insL = db.prepare('INSERT INTO lessons (course_id, title_ar, title_en, duration, position) VALUES (?, ?, ?, ?, ?)');
  for (const c of courses) {
    const info = insC.run(c.titleAr, c.titleEn, c.descAr, c.descEn, c.price, c.icon, c.theme);
    c.lessons.forEach((l, i) => insL.run(info.lastInsertRowid, l[0], l[1], l[2], i + 1));
  }
  console.log('seeded', courses.length, 'courses');
} else {
  console.log('courses already seeded:', hasCourses);
}

const set = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING');
set.run('whatsapp', process.env.SALES_WHATSAPP || '2010XXXXXXXX');
set.run('instapay', process.env.INSTAPAY || 'noor.academy@instapay');
set.run('wallet', process.env.WALLET_NUMBER || '010XXXXXXXX');
set.run('wallet_name', process.env.WALLET_NAME || 'فودافون كاش');
console.log('settings seeded');
console.log('DONE');
