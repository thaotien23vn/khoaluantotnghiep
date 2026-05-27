const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, connectDB, models } = require('./index');

// Danh sách URL YouTube embed đã kiểm tra còn hoạt động
const SAFE_YOUTUBE_URLS = [
  'https://www.youtube.com/embed/pQN-pnXPaVg',
  'https://www.youtube.com/embed/yfoY53QX3Oo',
  'https://www.youtube.com/embed/JJSoEo8JSnc',
  'https://www.youtube.com/embed/jS4aFq5v9do',
  'https://www.youtube.com/embed/bMknfKXIFA8',
  'https://www.youtube.com/embed/rfscVS0vtbw',
  'https://www.youtube.com/embed/i_LwzRVP7bg',
  'https://www.youtube.com/embed/nU-IIXBWlFw',
  'https://www.youtube.com/embed/FTFaQ1O3nHQ',
  'https://www.youtube.com/embed/W0zLllV8b1c',
  'https://www.youtube.com/embed/ZtqBQ68AwJU',
  'https://www.youtube.com/embed/M7lc1TVf24Q',
  'https://www.youtube.com/embed/PkZNo7MFNFg',
  'https://www.youtube.com/embed/9zBudxeYIH4',
  'https://www.youtube.com/embed/2uvysTqdh-U',
  'https://www.youtube.com/embed/ycXq8AhJWbc',
  'https://www.youtube.com/embed/4zfkehO2hDM',
  'https://www.youtube.com/embed/1nXzzBg8g8U',
  'https://www.youtube.com/embed/WtlvKp1lRLk',
  'https://www.youtube.com/embed/9jR6mL1TN0A',
];

// ============================================================================
// 1. CATEGORIES WITH UNSPLASH THUMBNAILS
// ============================================================================
const CATEGORY_META = {
  'Lập trình Web': {
    icon: 'Globe',
    desc: 'HTML, CSS, JavaScript, React, Node.js và các framework hiện đại',
    thumbnails: [
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80',
      'https://images.unsplash.com/photo-1592609931095-78d1b024e767?w=800&q=80',
      'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800&q=80',
    ],
  },
  'Khoa học Dữ liệu': {
    icon: 'Database',
    desc: 'Python, Machine Learning, AI, Phân tích dữ liệu',
    thumbnails: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&q=80',
      'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800&q=80',
    ],
  },
  'Thiết kế & UX/UI': {
    icon: 'Palette',
    desc: 'Figma, Adobe XD, nguyên tắc thiết kế, trải nghiệm người dùng',
    thumbnails: [
      'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=80',
      'https://images.unsplash.com/photo-1586717791821-3f44a5638d48?w=800&q=80',
      'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80',
    ],
  },
  'Marketing Digital': {
    icon: 'TrendingUp',
    desc: 'SEO, Content Marketing, Social Media, Google Ads',
    thumbnails: [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',
      'https://images.unsplash.com/photo-1533750349088-cd871fe92f6f?w=800&q=80',
      'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80',
    ],
  },
  'Kinh doanh & Khởi nghiệp': {
    icon: 'Briefcase',
    desc: 'Quản trị doanh nghiệp, lập kế hoạch, tài chính cơ bản',
    thumbnails: [
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
      'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
    ],
  },
  'Ngoại ngữ': {
    icon: 'Languages',
    desc: 'Tiếng Anh, tiếng Nhật, tiếng Hàn và các ngôn ngữ khác',
    thumbnails: [
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&q=80',
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&q=80',
      'https://images.unsplash.com/photo-1529390079861-59196fe0bfb1?w=800&q=80',
    ],
  },
  'Kỹ năng mềm': {
    icon: 'Users',
    desc: 'Giao tiếp, thuyết trình, làm việc nhóm, quản lý thời gian',
    thumbnails: [
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80',
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=800&q=80',
    ],
  },
  'CNTT & Bảo mật': {
    icon: 'Shield',
    desc: 'Mạng máy tính, bảo mật, DevOps, Cloud Computing',
    thumbnails: [
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80',
      'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80',
      'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80',
    ],
  },
};

// ============================================================================
// 2. TEACHERS DATA
// ============================================================================
const TEACHERS = [
  {
    name: 'Nguyễn Văn Minh',
    username: 'minhnguyen',
    email: 'minh.nguyen@lms.com',
    bio: 'Senior Full-Stack Developer với 10 năm kinh nghiệm. Từng làm việc tại Google, Shopee. Chuyên gia React, Node.js và System Design.',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=face',
    specialty: 'Lập trình Web',
  },
  {
    name: 'Trần Thị Hương',
    username: 'huongtran',
    email: 'huong.tran@lms.com',
    bio: 'Data Scientist với bằng tiến sĩ từ MIT. 8 năm kinh nghiệm Machine Learning, NLP và Computer Vision tại các startup AI hàng đầu.',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=face',
    specialty: 'Khoa học Dữ liệu',
  },
  {
    name: 'Lê Hoàng Anh',
    username: 'anhle_design',
    email: 'anh.le@lms.com',
    bio: 'Product Designer với portfolio tại Dribbble Top 100. 7 năm kinh nghiệm UI/UX cho SaaS và fintech. Mentor tại Google Design.',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    specialty: 'Thiết kế & UX/UI',
  },
  {
    name: 'Phạm Quỳnh Như',
    username: 'nhupham',
    email: 'nhu.pham@lms.com',
    bio: 'Digital Marketing Director với chứng chỉ Google, Meta, HubSpot. Đã đào tạo 5000+ học viên content marketing và growth hacking.',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=face',
    specialty: 'Marketing Digital',
  },
  {
    name: 'Hoàng Văn Đức',
    username: 'duchoang',
    email: 'duc.hoang@lms.com',
    bio: 'Tiến sĩ Kinh tế học, từng là Giám đốc chiến lược tại Unilever. Chuyên gia khởi nghiệp, đã tư vấn cho 50+ startup thành công.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    specialty: 'Kinh doanh & Khởi nghiệp',
  },
  {
    name: 'Sarah Johnson',
    username: 'sarahjohnson',
    email: 'sarah.j@lms.com',
    bio: 'Giáo viên tiếng Anh bản ngữ từ Anh Quốc, chứng chỉ CELTA và DELTA. 12 năm giảng dạy IELTS, Business English cho doanh nghiệp.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
    specialty: 'Ngoại ngữ',
  },
  {
    name: 'Vũ Thị Mai Linh',
    username: 'mailinhvu',
    email: 'mailinh.vu@lms.com',
    bio: 'Certified Life Coach (ICF) và Speaker chuyên nghiệp. Tác giả bestseller "Tư duy tích cực". Đào tạo kỹ năng mềm cho FPT, Viettel.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face',
    specialty: 'Kỹ năng mềm',
  },
  {
    name: 'Đặng Minh Khôi',
    username: 'khoisec',
    email: 'khoi.dang@lms.com',
    bio: 'Ethical Hacker chứng chỉ OSCP, CEH. Từng làm việc tại Bkav, CMC. Chuyên gia Pentest, SOC, Cloud Security (AWS, Azure).',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=face',
    specialty: 'CNTT & Bảo mật',
  },
];

// ============================================================================
// 3. COURSES DATA WITH REAL YOUTUBE VIDEOS
// ============================================================================
const COURSES_DATA = [
  // ───────────────────────────────────────────────────────────────────────────
  // LẬP TRÌNH WEB
  // ───────────────────────────────────────────────────────────────────────────
  {
    category: 'Lập trình Web',
    teacherUsername: 'minhnguyen',
    courses: [
      {
        title: 'HTML & CSS Cơ Bản - Xây Dựng Website Từ Con Số 0',
        level: 'beginner',
        price: 0,
        duration: '12 giờ',
        thumbnail: CATEGORY_META['Lập trình Web'].thumbnails[0],
        description:
          'Khóa học dành cho người mới bắt đầu. Bạn sẽ học cách xây dựng trang web tĩnh hoàn chỉnh với HTML5 semantic markup và CSS3 Flexbox/Grid. Cuối khóa, bạn tự tay code portfolio cá nhân đẹp mắt, responsive trên mọi thiết bị.',
        chapters: [
          {
            title: 'Chương 1: HTML5 Semantic & Structure',
            lectures: [
              { title: 'Giới thiệu HTML & Công cụ cần thiết', videoUrl: 'https://www.youtube.com/embed/pQN-pnXPaVg', duration: 900 },
              { title: 'HTML Tags cơ bản: headings, paragraphs, links', videoUrl: 'https://www.youtube.com/embed/HD13eq_Pmp8', duration: 1200 },
              { title: 'HTML Forms & Input Elements', videoUrl: 'https://www.youtube.com/embed/mJgBOIoGihA', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: CSS3 Styling & Layout',
            lectures: [
              { title: 'Selectors, Colors, Fonts & Box Model', videoUrl: 'https://www.youtube.com/embed/yfoY53QX3Oo', duration: 1300 },
              { title: 'Flexbox - Layout 1 chiều hiệu quả', videoUrl: 'https://www.youtube.com/embed/JJSoEo8JSnc', duration: 1400 },
              { title: 'CSS Grid - Layout 2 chiều mạnh mẽ', videoUrl: 'https://www.youtube.com/embed/9zBudxeYIH4', duration: 1500 },
            ],
          },
          {
            title: 'Chương 3: Responsive Design & Project',
            lectures: [
              { title: 'Media Queries & Mobile-first', videoUrl: 'https://www.youtube.com/embed/2KL-z9A56jU', duration: 1000 },
              { title: 'Xây dựng Portfolio Website hoàn chỉnh', videoUrl: 'https://www.youtube.com/embed/5ccq_nLHneE', duration: 2000 },
            ],
          },
        ],
      },
      {
        title: 'JavaScript Modern ES6+ - Tư duy lập trình',
        level: 'intermediate',
        price: 199000,
        duration: '18 giờ',
        thumbnail: CATEGORY_META['Lập trình Web'].thumbnails[1],
        description:
          'Khóa học JavaScript chuyên sâu từ ES6 đến ES2023. Hiểu sâu closure, prototype, async/await, event loop. Thực hành DOM manipulation, fetch API, module bundlers. Dự án cuối: ứng dụng Todo App với LocalStorage và CRUD.',
        chapters: [
          {
            title: 'Chương 1: JavaScript Fundamentals',
            lectures: [
              { title: 'Variables, Data Types & Operators', videoUrl: 'https://www.youtube.com/embed/jS4aFq5v9do', duration: 1100 },
              { title: 'Functions, Arrow Functions & Scope', videoUrl: 'https://www.youtube.com/embed/PkZNo7MFNFg', duration: 1200 },
              { title: 'Arrays, Objects & Destructuring', videoUrl: 'https://www.youtube.com/embed/3PHXvlpOkf4', duration: 1300 },
            ],
          },
          {
            title: 'Chương 2: DOM & Asynchronous JS',
            lectures: [
              { title: 'DOM Manipulation & Events', videoUrl: 'https://www.youtube.com/embed/y17RuWkWdn8', duration: 1400 },
              { title: 'Fetch API, Promises & Async/Await', videoUrl: 'https://www.youtube.com/embed/ZuQNGv4dBVs', duration: 1500 },
              { title: 'Event Loop & Microtasks', videoUrl: 'https://www.youtube.com/embed/8aGhZQkoW2E', duration: 900 },
            ],
          },
          {
            title: 'Chương 3: Dự án Todo App',
            lectures: [
              { title: 'Thiết kế UI & Cấu trúc dữ liệu', videoUrl: 'https://www.youtube.com/embed/Ttf3CEsYwMQ', duration: 1000 },
              { title: 'Implement CRUD với LocalStorage', videoUrl: 'https://www.youtube.com/embed/jS4aFq5v9do', duration: 1600 },
              { title: 'Deploy lên Vercel/Netlify', videoUrl: 'https://www.youtube.com/embed/lEH8zEZEtrc', duration: 800 },
            ],
          },
        ],
      },
      {
        title: 'React 18 & Redux Toolkit - Fullstack SPA',
        level: 'advanced',
        price: 499000,
        duration: '28 giờ',
        thumbnail: CATEGORY_META['Lập trình Web'].thumbnails[2],
        description:
          'Khóa học React 18 nâng cao: Hooks, Context API, Redux Toolkit, React Router v6. Kết hợp TailwindCSS, TypeScript cơ bản. Dự án cuối: E-commerce dashboard với giỏ hàng, phân trang, filter, dark mode.',
        chapters: [
          {
            title: 'Chương 1: React Core Concepts',
            lectures: [
              { title: 'Components, Props, State & JSX', videoUrl: 'https://www.youtube.com/embed/bMknfKXIFA8', duration: 1200 },
              { title: 'useEffect, useRef & Custom Hooks', videoUrl: 'https://www.youtube.com/embed/0h2b4ftbDJc', duration: 1400 },
              { title: 'Context API & useReducer', videoUrl: 'https://www.youtube.com/embed/5Ql-Qwej4UQ', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: State Management & Routing',
            lectures: [
              { title: 'Redux Toolkit & RTK Query', videoUrl: 'https://www.youtube.com/embed/9jR6mL1TN0A', duration: 1600 },
              { title: 'React Router v6 - Navigation bảo mật', videoUrl: 'https://www.youtube.com/embed/2a8PgTVFfRm', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án E-commerce Dashboard',
            lectures: [
              { title: 'Setup project với Vite + Tailwind', videoUrl: 'https://www.youtube.com/embed/lHZwlzOUOZU', duration: 900 },
              { title: 'Product List, Filter & Pagination', videoUrl: 'https://www.youtube.com/embed/bMknfKXIFA8', duration: 1800 },
              { title: 'Giỏ hàng, Checkout & Dark Mode', videoUrl: 'https://www.youtube.com/embed/1m3lS3mE9Vc', duration: 1500 },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // KHOA HỌC DỮ LIỆU
  // ───────────────────────────────────────────────────────────────────────────
  {
    category: 'Khoa học Dữ liệu',
    teacherUsername: 'huongtran',
    courses: [
      {
        title: 'Python cho Người Mới - Từ Zero đến Data Analysis',
        level: 'beginner',
        price: 0,
        duration: '14 giờ',
        thumbnail: CATEGORY_META['Khoa học Dữ liệu'].thumbnails[0],
        description:
          'Khóa học Python cơ bản tập trung vào ứng dụng phân tích dữ liệu. Học syntax, list comprehension, dictionaries, file I/O. Làm quen Pandas để xử lý CSV, Excel. Dự án: Phân tích doanh thu cửa hàng từ dataset thực tế.',
        chapters: [
          {
            title: 'Chương 1: Python Basics',
            lectures: [
              { title: 'Cài đặt môi trường & Jupyter Notebook', videoUrl: 'https://www.youtube.com/embed/rfscVS0vtbw', duration: 800 },
              { title: 'Variables, Data Types & Control Flow', videoUrl: 'https://www.youtube.com/embed/k9TUPpGqYTo', duration: 1100 },
              { title: 'Functions, Modules & List Comprehension', videoUrl: 'https://www.youtube.com/embed/Kyh1RlUcD_8', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Data Analysis với Pandas',
            lectures: [
              { title: 'DataFrames, Series & Indexing', videoUrl: 'https://www.youtube.com/embed/2uvysTqdh-U', duration: 1200 },
              { title: 'Filtering, GroupBy & Aggregation', videoUrl: 'https://www.youtube.com/embed/tN-vQXi-7Hg', duration: 1300 },
              { title: 'Merge, Join & Pivot Tables', videoUrl: 'https://www.youtube.com/embed/Ztltua3Y0Lc', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Phân tích Doanh thu',
            lectures: [
              { title: 'Đọc & làm sạch dataset cửa hàng', videoUrl: 'https://www.youtube.com/embed/QpTqV9H3Egk', duration: 1000 },
              { title: 'Trực quan hóa với Matplotlib', videoUrl: 'https://www.youtube.com/embed/3Xwb3WMBI4Y', duration: 1400 },
              { title: 'Xuất báo cáo & Insights', videoUrl: 'https://www.youtube.com/embed/F-7pf9x13KI', duration: 900 },
            ],
          },
        ],
      },
      {
        title: 'Machine Learning Cơ Bản - Scikit-Learn & Theory',
        level: 'intermediate',
        price: 299000,
        duration: '22 giờ',
        thumbnail: CATEGORY_META['Khoa học Dữ liệu'].thumbnails[1],
        description:
          'Nền tảng ML từ toán học đến thực hành: Linear Regression, Logistic Regression, Decision Trees, Random Forest, SVM. Feature engineering, cross-validation, hyperparameter tuning. Dự án: Dự đoán giá nhà & phân loại khách hàng.',
        chapters: [
          {
            title: 'Chương 1: ML Foundations',
            lectures: [
              { title: 'Giới thiệu ML & Pipeline cơ bản', videoUrl: 'https://www.youtube.com/embed/i_LwzRVP7bg', duration: 1000 },
              { title: 'Data Preprocessing & Feature Scaling', videoUrl: 'https://www.youtube.com/embed/0Lt9w-BxKFQ', duration: 1200 },
              { title: 'Train/Test Split & Cross-Validation', videoUrl: 'https://www.youtube.com/embed/BgzZjybkYH8', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Supervised Learning Algorithms',
            lectures: [
              { title: 'Linear & Polynomial Regression', videoUrl: 'https://www.youtube.com/embed/WtlvKp1lRLk', duration: 1400 },
              { title: 'Logistic Regression & SVM', videoUrl: 'https://www.youtube.com/embed/J5bXv5O5wZk', duration: 1300 },
              { title: 'Decision Trees & Random Forest', videoUrl: 'https://www.youtube.com/embed/W8adIcfRkyU', duration: 1500 },
            ],
          },
          {
            title: 'Chương 3: Dự án Dự đoán Giá Nhà',
            lectures: [
              { title: 'EDA & Feature Engineering', videoUrl: 'https://www.youtube.com/embed/f2yu5eK1wZQ', duration: 1600 },
              { title: 'Model Selection & Hyperparameter Tuning', videoUrl: 'https://www.youtube.com/embed/NUXmp0E46x8', duration: 1400 },
              { title: 'Đánh giá Model & Deploy', videoUrl: 'https://www.youtube.com/embed/PePkLlQJIek', duration: 1000 },
            ],
          },
        ],
      },
      {
        title: 'Deep Learning với PyTorch - CNN & NLP',
        level: 'advanced',
        price: 599000,
        duration: '32 giờ',
        thumbnail: CATEGORY_META['Khoa học Dữ liệu'].thumbnails[2],
        description:
          'Deep Learning chuyên sâu: Neural Networks, Backpropagation, CNN cho Computer Vision, RNN/LSTM/Transformer cho NLP. Fine-tuning BERT, GPT. Dự án: Phân loại ảnh y tế & Sentiment Analysis tiếng Việt.',
        chapters: [
          {
            title: 'Chương 1: Neural Networks & PyTorch',
            lectures: [
              { title: 'Tensors, Autograd & Optimizers', videoUrl: 'https://www.youtube.com/embed/c36UNSo_0Pw', duration: 1200 },
              { title: 'Building Neural Networks với nn.Module', videoUrl: 'https://www.youtube.com/embed/3kL1P4c4y2E', duration: 1400 },
              { title: 'Training Loop & GPU Acceleration', videoUrl: 'https://www.youtube.com/embed/V_xro1BCp1M', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: CNN & Computer Vision',
            lectures: [
              { title: 'Convolution, Pooling & BatchNorm', videoUrl: 'https://www.youtube.com/embed/ycXq8AhJWbc', duration: 1500 },
              { title: 'Transfer Learning với ResNet/EfficientNet', videoUrl: 'https://www.youtube.com/embed/9C06ZPF8Uuc', duration: 1300 },
            ],
          },
          {
            title: 'Chương 3: NLP & Transformer',
            lectures: [
              { title: 'Word Embeddings & LSTM', videoUrl: 'https://www.youtube.com/embed/4Bdc55j80j8', duration: 1200 },
              { title: 'Attention Mechanism & Transformer', videoUrl: 'https://www.youtube.com/embed/4zfkehO2hDM', duration: 1600 },
              { title: 'Fine-tuning BERT cho tiếng Việt', videoUrl: 'https://www.youtube.com/embed/1nXzzBg8g8U', duration: 1800 },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // THIẾT KẾ & UX/UI
  // ───────────────────────────────────────────────────────────────────────────
  {
    category: 'Thiết kế & UX/UI',
    teacherUsername: 'anhle_design',
    courses: [
      {
        title: 'UI Design Cơ Bản với Figma - Từ Wireframe đến Prototype',
        level: 'beginner',
        price: 0,
        duration: '10 giờ',
        thumbnail: CATEGORY_META['Thiết kế & UX/UI'].thumbnails[0],
        description:
          'Khóa học Figma cho người mới: frames, components, auto-layout, variants. Hiểu design systems, color theory, typography. Dự án: Thiết kế giao diện app đặt vé xem phim với đầy đủ screens và prototype tương tác.',
        chapters: [
          {
            title: 'Chương 1: Figma Fundamentals',
            lectures: [
              { title: 'Giao diện Figma & Công cụ cơ bản', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 900 },
              { title: 'Frames, Groups & Constraints', videoUrl: 'https://www.youtube.com/embed/c9Wg6CbYsrU', duration: 1100 },
              { title: 'Components & Instances', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Auto Layout & Design Systems',
            lectures: [
              { title: 'Auto Layout - Responsive trong Figma', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 1200 },
              { title: 'Variants & Interactive Components', videoUrl: 'https://www.youtube.com/embed/c9Wg6CbYsrU', duration: 1000 },
              { title: 'Color Theory & Typography cho UI', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án App Đặt Vé Xem Phim',
            lectures: [
              { title: 'Wireframe & User Flow', videoUrl: 'https://www.youtube.com/embed/c9Wg6CbYsrU', duration: 900 },
              { title: 'Visual Design & Component Library', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1300 },
              { title: 'Prototype & Handoff cho Developer', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 1000 },
            ],
          },
        ],
      },
      {
        title: 'UX Research & Design Thinking - Hiểu Người Dùng',
        level: 'intermediate',
        price: 249000,
        duration: '16 giờ',
        thumbnail: CATEGORY_META['Thiết kế & UX/UI'].thumbnails[1],
        description:
          'UX Research phương pháp luận: User interviews, surveys, usability testing, heuristic evaluation. Journey mapping, persona creation. Áp dụng Design Thinking 5 bước. Dự án: Cải thiện UX cho app giao hàng thực tế.',
        chapters: [
          {
            title: 'Chương 1: UX Research Methods',
            lectures: [
              { title: 'User Interviews & Affinity Mapping', videoUrl: 'https://www.youtube.com/embed/c9Wg6CbYsrU', duration: 1000 },
              { title: 'Surveys & Quantitative Analysis', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1100 },
              { title: 'Usability Testing & Heuristic Evaluation', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 1200 },
            ],
          },
          {
            title: 'Chương 2: Design Thinking Process',
            lectures: [
              { title: 'Empathize - Journey Map & Personas', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 1100 },
              { title: 'Define - Problem Statements & HMW', videoUrl: 'https://www.youtube.com/embed/c9Wg6CbYsrU', duration: 900 },
              { title: 'Ideate & Prototype - Crazy 8s & Testing', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1300 },
            ],
          },
          {
            title: 'Chương 3: Dự án Cải thiện App Giao Hàng',
            lectures: [
              { title: 'Research & Phát hiện Pain Points', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1000 },
              { title: 'Redesign Checkout Flow & Tracking', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 1400 },
              { title: 'A/B Testing & Iteration', videoUrl: 'https://www.youtube.com/embed/c9Wg6CbYsrU', duration: 1000 },
            ],
          },
        ],
      },
      {
        title: 'Advanced UI Animation - After Effects & Lottie',
        level: 'advanced',
        price: 399000,
        duration: '20 giờ',
        thumbnail: CATEGORY_META['Thiết kế & UX/UI'].thumbnails[2],
        description:
          'UI Animation chuyên nghiệp: Micro-interactions, page transitions, loading states. Sử dụng After Effects, export Lottie JSON cho web/mobile. Motion design principles: easing, timing, storytelling. Dự án: Animation set cho fintech app.',
        chapters: [
          {
            title: 'Chương 1: Motion Design Principles',
            lectures: [
              { title: '12 Principles of Animation áp dụng UI', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1100 },
              { title: 'Easing Curves & Timing Functions', videoUrl: 'https://www.youtube.com/embed/c9Wg6CbYsrU', duration: 1000 },
              { title: 'Storytelling qua Motion', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 1200 },
            ],
          },
          {
            title: 'Chương 2: After Effects cho UI',
            lectures: [
              { title: 'Shape Layers & Keyframes', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 1300 },
              { title: 'Export Lottie JSON & Integration', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Fintech Animation Set',
            lectures: [
              { title: 'Onboarding Flow Animation', videoUrl: 'https://www.youtube.com/embed/c9Wg6CbYsrU', duration: 1200 },
              { title: 'Transaction Success & Error States', videoUrl: 'https://www.youtube.com/embed/FTFaQ1O3nHQ', duration: 1400 },
              { title: 'Dashboard Charts & Loading Skeleton', videoUrl: 'https://www.youtube.com/embed/OZ1HhLao-EQ', duration: 1000 },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // MARKETING DIGITAL
  // ───────────────────────────────────────────────────────────────────────────
  {
    category: 'Marketing Digital',
    teacherUsername: 'nhupham',
    courses: [
      {
        title: 'SEO Cơ Bản - Tối Ưu Website Lên Top Google',
        level: 'beginner',
        price: 0,
        duration: '10 giờ',
        thumbnail: CATEGORY_META['Marketing Digital'].thumbnails[0],
        description:
          'Khóa học SEO thực hành: keyword research, on-page SEO, technical SEO, link building. Sử dụng Google Search Console, Ahrefs, SEMrush. Dự án: Tối ưu blog cá nhân lên top 10 từ khóa trong 30 ngày.',
        chapters: [
          {
            title: 'Chương 1: SEO Foundations',
            lectures: [
              { title: 'Hiểu cách Google Search hoạt động', videoUrl: 'https://www.youtube.com/embed/nU-IIXBWlFw', duration: 900 },
              { title: 'Keyword Research với Ahrefs & Ubersuggest', videoUrl: 'https://www.youtube.com/embed/xsVTqzT3I2c', duration: 1200 },
              { title: 'On-Page SEO: Title, Meta, Heading', videoUrl: 'https://www.youtube.com/embed/nU-IIXBWlFw', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Technical SEO & Content',
            lectures: [
              { title: 'Site Speed, Mobile-friendly & Core Web Vitals', videoUrl: 'https://www.youtube.com/embed/xsVTqzT3I2c', duration: 1000 },
              { title: 'Content Strategy & E-E-A-T', videoUrl: 'https://www.youtube.com/embed/nU-IIXBWlFw', duration: 1300 },
              { title: 'Internal Linking & Schema Markup', videoUrl: 'https://www.youtube.com/embed/xsVTqzT3I2c', duration: 900 },
            ],
          },
          {
            title: 'Chương 3: Dự án SEO Blog 30 ngày',
            lectures: [
              { title: 'Audit website & Lập kế hoạch từ khóa', videoUrl: 'https://www.youtube.com/embed/nU-IIXBWlFw', duration: 1100 },
              { title: 'Viết bài chuẩn SEO & Track ranking', videoUrl: 'https://www.youtube.com/embed/xsVTqzT3I2c', duration: 1400 },
              { title: 'Backlink building & Đánh giá kết quả', videoUrl: 'https://www.youtube.com/embed/nU-IIXBWlFw', duration: 1000 },
            ],
          },
        ],
      },
      {
        title: 'Content Marketing & Social Media Masterclass',
        level: 'intermediate',
        price: 249000,
        duration: '16 giờ',
        thumbnail: CATEGORY_META['Marketing Digital'].thumbnails[1],
        description:
          'Xây dựng thương hiệu cá nhân và doanh nghiệp qua content. Chiến lược TikTok, Instagram, Facebook, LinkedIn. Sử dụng Canva, CapCut, Meta Business Suite. Dự án: Xây dựng kênh TikTok 10K followers trong 60 ngày.',
        chapters: [
          {
            title: 'Chương 1: Content Strategy',
            lectures: [
              { title: 'Content Pillars & Editorial Calendar', videoUrl: 'https://www.youtube.com/embed/eL2vPDCN40w', duration: 1000 },
              { title: 'Copywriting: Headlines, Hooks & CTA', videoUrl: 'https://www.youtube.com/embed/pW4bP8l7VoE', duration: 1200 },
              { title: 'Visual Content với Canva Pro', videoUrl: 'https://www.youtube.com/embed/eL2vPDCN40w', duration: 900 },
            ],
          },
          {
            title: 'Chương 2: Social Media Growth',
            lectures: [
              { title: 'TikTok Algorithm & Trend jacking', videoUrl: 'https://www.youtube.com/embed/pW4bP8l7VoE', duration: 1300 },
              { title: 'Instagram Reels & Facebook Ads cơ bản', videoUrl: 'https://www.youtube.com/embed/eL2vPDCN40w', duration: 1100 },
              { title: 'LinkedIn B2B Content & Personal Branding', videoUrl: 'https://www.youtube.com/embed/pW4bP8l7VoE', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án TikTok 10K Followers',
            lectures: [
              { title: 'Niche research & Content series', videoUrl: 'https://www.youtube.com/embed/eL2vPDCN40w', duration: 1100 },
              { title: 'Quay & edit video với CapCut', videoUrl: 'https://www.youtube.com/embed/pW4bP8l7VoE', duration: 1400 },
              { title: 'Analytics, Iterate & Monetization', videoUrl: 'https://www.youtube.com/embed/eL2vPDCN40w', duration: 1000 },
            ],
          },
        ],
      },
      {
        title: 'Google Ads & Facebook Ads - Performance Marketing',
        level: 'advanced',
        price: 499000,
        duration: '22 giờ',
        thumbnail: CATEGORY_META['Marketing Digital'].thumbnails[2],
        description:
          'Quảng cáo trả phí chuyên sâu: Google Search Ads, Display, YouTube Ads, Facebook/Meta Ads, retargeting. A/B testing, conversion tracking, ROAS optimization. Dự án: Chạy chiến dịch 50 triệu đồng cho startup thực tế.',
        chapters: [
          {
            title: 'Chương 1: Google Ads Mastery',
            lectures: [
              { title: 'Campaign Structure & Keyword Match Types', videoUrl: 'https://www.youtube.com/embed/t6o2B7fN8bE', duration: 1200 },
              { title: 'Ad Copywriting & Quality Score', videoUrl: 'https://www.youtube.com/embed/nU-IIXBWlFw', duration: 1100 },
              { title: 'Conversion Tracking & Remarketing', videoUrl: 'https://www.youtube.com/embed/t6o2B7fN8bE', duration: 1300 },
            ],
          },
          {
            title: 'Chương 2: Facebook/Meta Ads',
            lectures: [
              { title: 'Pixel, Custom Audience & Lookalike', videoUrl: 'https://www.youtube.com/embed/pW4bP8l7VoE', duration: 1400 },
              { title: 'Creative Testing & CBO Strategy', videoUrl: 'https://www.youtube.com/embed/t6o2B7fN8bE', duration: 1200 },
              { title: 'Landing Page Optimization', videoUrl: 'https://www.youtube.com/embed/nU-IIXBWlFw', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án Chiến dịch 50 Triệu',
            lectures: [
              { title: 'Lập ngân sách & Target audience', videoUrl: 'https://www.youtube.com/embed/t6o2B7fN8bE', duration: 1100 },
              { title: 'A/B test creative & bidding strategy', videoUrl: 'https://www.youtube.com/embed/pW4bP8l7VoE', duration: 1500 },
              { title: 'Báo cáo ROAS & Scale campaign', videoUrl: 'https://www.youtube.com/embed/nU-IIXBWlFw', duration: 1200 },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // KINH DOANH & KHỞI NGHIỆP
  // ───────────────────────────────────────────────────────────────────────────
  {
    category: 'Kinh doanh & Khởi nghiệp',
    teacherUsername: 'duchoang',
    courses: [
      {
        title: 'Khởi Nghiệp Tinh Gọn - Từ Ý Tưởng đến MVP',
        level: 'beginner',
        price: 0,
        duration: '12 giờ',
        thumbnail: CATEGORY_META['Kinh doanh & Khởi nghiệp'].thumbnails[0],
        description:
          'Lean Startup methodology: idea validation, customer discovery, business model canvas, MVP development. Phân tích case study Grab, Momo, Canva. Dự án: Xây dựng business model cho ý tưởng của bạn và pitch với mentor.',
        chapters: [
          {
            title: 'Chương 1: Idea & Validation',
            lectures: [
              { title: 'Lean Startup & Design Thinking', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1000 },
              { title: 'Customer Discovery & Problem Interview', videoUrl: 'https://www.youtube.com/embed/RLi_1xK4VCE', duration: 1200 },
              { title: 'Business Model Canvas thực hành', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: MVP & Traction',
            lectures: [
              { title: 'Xây dựng MVP với no-code tools', videoUrl: 'https://www.youtube.com/embed/RLi_1xK4VCE', duration: 1300 },
              { title: 'Growth Hacking & Acquisition Channels', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1000 },
              { title: 'Metrics: CAC, LTV, Churn, PMF', videoUrl: 'https://www.youtube.com/embed/RLi_1xK4VCE', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Pitch & Fundraising',
            lectures: [
              { title: 'Storytelling & Pitch Deck Design', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1200 },
              { title: 'Định giá startup & Term Sheet', videoUrl: 'https://www.youtube.com/embed/RLi_1xK4VCE', duration: 1000 },
              { title: 'Demo Day & Q&A với Investor', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 900 },
            ],
          },
        ],
      },
      {
        title: 'Quản Trị Doanh Nghiệp Vừa và Nhỏ',
        level: 'intermediate',
        price: 299000,
        duration: '18 giờ',
        thumbnail: CATEGORY_META['Kinh doanh & Khởi nghiệp'].thumbnails[1],
        description:
          'Quản trị toàn diện cho SME: nhân sự, tài chính, vận hành, marketing. Xây dựng quy trình, KPI, văn hóa doanh nghiệp. Pháp lý, thuế, hợp đồng. Dự án: Tái cấu trúc quy trình cho cửa hàng/công ty thực tế.',
        chapters: [
          {
            title: 'Chương 1: Leadership & Team Building',
            lectures: [
              { title: 'Tuyển dụng & Onboarding hiệu quả', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1100 },
              { title: 'KPI, OKR & Performance Review', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1000 },
              { title: 'Văn hóa doanh nghiệp & Employee Engagement', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1200 },
            ],
          },
          {
            title: 'Chương 2: Finance & Operations',
            lectures: [
              { title: 'Kế toán cơ bản & Dòng tiền', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1300 },
              { title: 'Quản lý kho, chuỗi cung ứng & Logistics', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1100 },
              { title: 'Pháp lý, hợp đồng & Thuế cho SME', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án Tái cấu trúc Công ty',
            lectures: [
              { title: 'Audit quy trình hiện tại', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1000 },
              { title: 'Thiết kế workflow & Automation', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1400 },
              { title: 'Đo lường hiệu quả sau tái cấu trúc', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1100 },
            ],
          },
        ],
      },
      {
        title: 'Chiến Lược Kinh Doanh & M&A',
        level: 'advanced',
        price: 599000,
        duration: '24 giờ',
        thumbnail: CATEGORY_META['Kinh doanh & Khởi nghiệp'].thumbnails[2],
        description:
          'Chiến lược cấp cao: SWOT, Porter 5 Forces, Blue Ocean Strategy. M&A, due diligence, post-merger integration. Phân tích tài chính doanh nghiệp, định giá, risk management. Dự án: Mô phỏng thương vụ M&A thực tế.',
        chapters: [
          {
            title: 'Chương 1: Strategic Analysis',
            lectures: [
              { title: 'SWOT, PESTEL & Porter Five Forces', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1200 },
              { title: 'Blue Ocean Strategy & Value Innovation', videoUrl: 'https://www.youtube.com/embed/RLi_1xK4VCE', duration: 1100 },
              { title: 'Competitive Advantage & Moat', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1300 },
            ],
          },
          {
            title: 'Chương 2: M&A & Due Diligence',
            lectures: [
              { title: 'M&A Process & Deal Structuring', videoUrl: 'https://www.youtube.com/embed/RLi_1xK4VCE', duration: 1400 },
              { title: 'Financial Due Diligence & Valuation', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1200 },
              { title: 'Post-Merger Integration & Change Management', videoUrl: 'https://www.youtube.com/embed/RLi_1xK4VCE', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án M&A Simulation',
            lectures: [
              { title: 'Chọn target & Phân tích synergy', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1300 },
              { title: 'Negotiation & Term Sheet', videoUrl: 'https://www.youtube.com/embed/RLi_1xK4VCE', duration: 1500 },
              { title: 'Integration roadmap & Risk assessment', videoUrl: 'https://www.youtube.com/embed/qkWuMPy4_Fc', duration: 1200 },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // NGOẠI NGỮ
  // ───────────────────────────────────────────────────────────────────────────
  {
    category: 'Ngoại ngữ',
    teacherUsername: 'sarahjohnson',
    courses: [
      {
        title: 'Tiếng Anh Giao Tiếp Cơ Bản - Tự Tin Mở Miệng',
        level: 'beginner',
        price: 0,
        duration: '14 giờ',
        thumbnail: CATEGORY_META['Ngoại ngữ'].thumbnails[0],
        description:
          'Khóa học tiếng Anh thực dụng cho người mất gốc. Tập trung phát âm chuẩn IPA, ngữ pháp cơ bản, từ vựng theo chủ đề. Luyện nghe qua podcast, phim ảnh. Dự án: Thực hiện 5 cuộc hội thoại 5 phút với người bản xứ qua app.',
        chapters: [
          {
            title: 'Chương 1: Pronunciation & Basic Grammar',
            lectures: [
              { title: 'IPA Sounds & Word Stress', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 900 },
              { title: 'Present Simple, Continuous & Past Simple', videoUrl: 'https://www.youtube.com/embed/8Smb1b6s7Uw', duration: 1100 },
              { title: 'Question Forms & Short Answers', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Daily Communication',
            lectures: [
              { title: 'Greetings, Introductions & Small Talk', videoUrl: 'https://www.youtube.com/embed/8Smb1b6s7Uw', duration: 1200 },
              { title: 'Shopping, Dining & Travel English', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 1000 },
              { title: 'Phone Calls & Appointments', videoUrl: 'https://www.youtube.com/embed/8Smb1b6s7Uw', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Hội Thoại 5 phút',
            lectures: [
              { title: 'Luyện nghe qua TED-Ed & Podcasts', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 1000 },
              { title: 'Shadowing & Recording bản thân', videoUrl: 'https://www.youtube.com/embed/8Smb1b6s7Uw', duration: 1300 },
              { title: 'Live practice qua Cambly/HelloTalk', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 900 },
            ],
          },
        ],
      },
      {
        title: 'IELTS Academic - Target Band 7.0+',
        level: 'intermediate',
        price: 399000,
        duration: '26 giờ',
        thumbnail: CATEGORY_META['Ngoại ngữ'].thumbnails[1],
        description:
          'Luyện thi IELTS Academic toàn diện: Listening (all 4 sections), Reading (True/False/NG, Matching, Heading), Writing (Task 1 + Task 2), Speaking (Part 1-3). Chiến thuật làm bài, từ vựng academic, grammar band 7+. Dự án: Thi thử 3 lần & review chi tiết.',
        chapters: [
          {
            title: 'Chương 1: Listening & Reading',
            lectures: [
              { title: 'Listening Strategy & Note-taking', videoUrl: 'https://www.youtube.com/embed/8Smb1b6s7Uw', duration: 1200 },
              { title: 'Reading: Skimming, Scanning & Keywords', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1400 },
              { title: 'True/False/Not Given & Matching Tricks', videoUrl: 'https://www.youtube.com/embed/8Smb1b6s7Uw', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Writing Band 7+',
            lectures: [
              { title: 'Task 1: Line, Bar, Pie, Map, Process', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1500 },
              { title: 'Task 2: Opinion, Discussion, Problem-Solution', videoUrl: 'https://www.youtube.com/embed/8Smb1b6s7Uw', duration: 1300 },
              { title: 'Academic Vocabulary & Complex Sentences', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1200 },
            ],
          },
          {
            title: 'Chương 3: Speaking Fluency',
            lectures: [
              { title: 'Part 1: Hobbies, Work, Study - Natural Flow', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 1100 },
              { title: 'Part 2: Cue Card & 2-minute Monologue', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1400 },
              { title: 'Part 3: Abstract Discussion & Opinion', videoUrl: 'https://www.youtube.com/embed/8Smb1b6s7Uw', duration: 1200 },
            ],
          },
        ],
      },
      {
        title: 'Business English - Giao Tiếp Doanh Nghiệp',
        level: 'advanced',
        price: 349000,
        duration: '18 giờ',
        thumbnail: CATEGORY_META['Ngoại ngữ'].thumbnails[2],
        description:
          'Tiếng Anh chuyên ngành kinh doanh: email formal, meeting facilitation, negotiation, presentation, report writing. Từ vựng finance, marketing, HR. Dự án: Thuyết trình 15 phút về business case bằng tiếng Anh trước hội đồng.',
        chapters: [
          {
            title: 'Chương 1: Business Communication',
            lectures: [
              { title: 'Email Writing: Formal, Inquiry, Complaint', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1000 },
              { title: 'Meeting Language: Chairing, Minutes, Action items', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 1200 },
              { title: 'Negotiation Phrases & Tactics', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Presentation & Report',
            lectures: [
              { title: 'Structuring Presentation & Slides', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 1300 },
              { title: 'Data Description & Trend Language', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1000 },
              { title: 'Q&A Handling & Impromptu Speaking', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Thuyết Trình Business Case',
            lectures: [
              { title: 'Chọn case study & Research data', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1000 },
              { title: 'Viết script & Design slides chuyên nghiệp', videoUrl: 'https://www.youtube.com/embed/lIz6JmVhQZs', duration: 1400 },
              { title: 'Thuyết trình trước hội đồng & Feedback', videoUrl: 'https://www.youtube.com/embed/bN4Lb0xO05A', duration: 1200 },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // KỸ NĂNG MỀM
  // ───────────────────────────────────────────────────────────────────────────
  {
    category: 'Kỹ năng mềm',
    teacherUsername: 'mailinhvu',
    courses: [
      {
        title: 'Giao Tiếp & Thuyết Trình Hiệu Quả',
        level: 'beginner',
        price: 0,
        duration: '10 giờ',
        thumbnail: CATEGORY_META['Kỹ năng mềm'].thumbnails[0],
        description:
          'Kỹ năng giao tiếp cơ bản: lắng nghe chủ động, ngôn ngữ cơ thể, phản hồi tích cực. Thuyết trình: cấu trúc bài nói, sử dụng slide, xử lý căng thẳng. Dự án: Thuyết trình 10 phút về chủ đề tự chọn trước 20 người.',
        chapters: [
          {
            title: 'Chương 1: Communication Foundations',
            lectures: [
              { title: 'Active Listening & Empathy', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 900 },
              { title: 'Non-verbal Communication & Body Language', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1100 },
              { title: 'Feedback: Giving & Receiving', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Public Speaking',
            lectures: [
              { title: 'Cấu trúc bài nói: Mở - Thân - Kết', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1200 },
              { title: 'Voice Control, Pause & Storytelling', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 1000 },
              { title: 'Xử lý sự cố & Q&A tự tin', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Thuyết Trình 10 phút',
            lectures: [
              { title: 'Chọn chủ đề & Outline bài nói', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 1000 },
              { title: 'Slide design & Rehearsal techniques', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1300 },
              { title: 'Record & Self-review trước audience', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 900 },
            ],
          },
        ],
      },
      {
        title: 'Làm Việc Nhóm & Quản Lý Xung Đột',
        level: 'intermediate',
        price: 199000,
        duration: '14 giờ',
        thumbnail: CATEGORY_META['Kỹ năng mềm'].thumbnails[1],
        description:
          'Teamwork chuyên nghiệp: vai trò trong nhóm (Belbin), quy trình làm việc nhóm hiệu quả. Quản lý xung đột: Thomas-Kilmann, mediation, đàm phán. Agile mindset trong teamwork. Dự án: Giải quyết case study xung đột nhóm thực tế.',
        chapters: [
          {
            title: 'Chương 1: Team Dynamics',
            lectures: [
              { title: 'Belbin Team Roles & Self-assessment', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1000 },
              { title: 'Effective Meeting & Decision Making', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1100 },
              { title: 'Remote Teamwork & Async Communication', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Conflict Management',
            lectures: [
              { title: 'Thomas-Kilmann Conflict Mode', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1200 },
              { title: 'Difficult Conversations & Mediation', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1300 },
              { title: 'Negotiation & Win-Win Solutions', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Giải Quyết Xung Đột',
            lectures: [
              { title: 'Phân tích case study xung đột nhóm', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1000 },
              { title: 'Thiết kế giải pháp & Mediation plan', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1400 },
              { title: 'Role-play & Feedback từ mentor', videoUrl: 'https://www.youtube.com/embed/6c4BqV7WacI', duration: 1000 },
            ],
          },
        ],
      },
      {
        title: 'Quản Lý Thời Gian & Năng Suất Cá Nhân',
        level: 'advanced',
        price: 249000,
        duration: '12 giờ',
        thumbnail: CATEGORY_META['Kỹ năng mềm'].thumbnails[2],
        description:
          'Productivity systems: GTD, Pomodoro, Time Blocking, Eisenhower Matrix. Deep Work theo Cal Newport. Xây dựng thói quen, loại bỏ distraction. Dự án: Thiết kế hệ thống quản lý thời gian cá nhân trong 30 ngày và đo lường hiệu quả.',
        chapters: [
          {
            title: 'Chương 1: Time Management Systems',
            lectures: [
              { title: 'Eisenhower Matrix & Pareto Principle', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 900 },
              { title: 'GTD: Capture, Clarify, Organize, Reflect', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1200 },
              { title: 'Time Blocking & Calendar Management', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Deep Work & Habits',
            lectures: [
              { title: 'Deep Work vs Shallow Work', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1100 },
              { title: 'Eliminate Distraction: Digital Minimalism', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 1300 },
              { title: 'Habit Stacking & Atomic Habits', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án 30 Ngày Năng Suất',
            lectures: [
              { title: 'Audit thời gian hiện tại & Xác định mục tiêu', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 1000 },
              { title: 'Thiết kế hệ thống cá nhân hóa', videoUrl: 'https://www.youtube.com/embed/iONDebHX9qk', duration: 1200 },
              { title: 'Tracking, Review & Iteration', videoUrl: 'https://www.youtube.com/embed/HAnwNfHSC3Q', duration: 900 },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  // CNTT & BẢO MẬT
  // ───────────────────────────────────────────────────────────────────────────
  {
    category: 'CNTT & Bảo mật',
    teacherUsername: 'khoisec',
    courses: [
      {
        title: 'Mạng Máy Tính & Linux Cơ Bản',
        level: 'beginner',
        price: 0,
        duration: '14 giờ',
        thumbnail: CATEGORY_META['CNTT & Bảo mật'].thumbnails[0],
        description:
          'Nền tảng CNTT: OSI Model, TCP/IP, DNS, DHCP, subnetting. Linux Ubuntu/Debian cơ bản: terminal, file system, permissions, shell scripting. Dự án: Thiết lập máy chủ web cá nhân với LAMP stack trên VPS.',
        chapters: [
          {
            title: 'Chương 1: Networking Fundamentals',
            lectures: [
              { title: 'OSI Model & TCP/IP Stack', videoUrl: 'https://www.youtube.com/embed/W0zLllV8b1c', duration: 1000 },
              { title: 'IP Addressing, Subnetting & Routing', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1200 },
              { title: 'DNS, DHCP & NAT explained', videoUrl: 'https://www.youtube.com/embed/W0zLllV8b1c', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Linux Essentials',
            lectures: [
              { title: 'Linux Distros & Terminal Basics', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1000 },
              { title: 'File System, Permissions & Users', videoUrl: 'https://www.youtube.com/embed/W0zLllV8b1c', duration: 1300 },
              { title: 'Shell Scripting & Cron Jobs', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án LAMP Server',
            lectures: [
              { title: 'Cài đặt Ubuntu Server trên VPS', videoUrl: 'https://www.youtube.com/embed/W0zLllV8b1c', duration: 1000 },
              { title: 'Cấu hình Apache, MySQL, PHP', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1400 },
              { title: 'Security hardening & Monitoring', videoUrl: 'https://www.youtube.com/embed/W0zLllV8b1c', duration: 1000 },
            ],
          },
        ],
      },
      {
        title: 'Ethical Hacking & Penetration Testing',
        level: 'intermediate',
        price: 399000,
        duration: '24 giờ',
        thumbnail: CATEGORY_META['CNTT & Bảo mật'].thumbnails[1],
        description:
          'Hacking có đạo đức: reconnaissance, scanning, enumeration, exploitation, post-exploitation. Sử dụng Kali Linux, Metasploit, Burp Suite, Nmap. OWASP Top 10. Dự án: Pentest một ứng dụng web thực tế và viết báo cáo chuyên nghiệp.',
        chapters: [
          {
            title: 'Chương 1: Recon & Scanning',
            lectures: [
              { title: 'Passive vs Active Reconnaissance', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1100 },
              { title: 'Nmap, Masscan & Service Enumeration', videoUrl: 'https://www.youtube.com/embed/9zUHg7xjIqQ', duration: 1300 },
              { title: 'Vulnerability Scanning với Nessus/OpenVAS', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1200 },
            ],
          },
          {
            title: 'Chương 2: Web App Exploitation',
            lectures: [
              { title: 'OWASP Top 10: Injection & Broken Auth', videoUrl: 'https://www.youtube.com/embed/9zUHg7xjIqQ', duration: 1400 },
              { title: 'XSS, CSRF & IDOR Exploitation', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1300 },
              { title: 'Burp Suite: Proxy, Repeater, Intruder', videoUrl: 'https://www.youtube.com/embed/9zUHg7xjIqQ', duration: 1200 },
            ],
          },
          {
            title: 'Chương 3: Dự án Pentest Web App',
            lectures: [
              { title: 'Scope definition & Rules of Engagement', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1000 },
              { title: 'Thực hiện pentest & Khai thác lỗ hổng', videoUrl: 'https://www.youtube.com/embed/9zUHg7xjIqQ', duration: 1600 },
              { title: 'Viết báo cáo & Remediation plan', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1100 },
            ],
          },
        ],
      },
      {
        title: 'Cloud Security & DevSecOps',
        level: 'advanced',
        price: 599000,
        duration: '28 giờ',
        thumbnail: CATEGORY_META['CNTT & Bảo mật'].thumbnails[2],
        description:
          'Bảo mật trên AWS/Azure/GCP: IAM, VPC, WAF, encryption, compliance. DevSecOps: CI/CD security, container security, Infrastructure as Code security. SOC operations: SIEM, incident response, forensics. Dự án: Xây dựng pipeline DevSecOps hoàn chỉnh.',
        chapters: [
          {
            title: 'Chương 1: Cloud Security Architecture',
            lectures: [
              { title: 'Shared Responsibility Model', videoUrl: 'https://www.youtube.com/embed/9zUHg7xjIqQ', duration: 1200 },
              { title: 'IAM, VPC, Security Groups & NACLs', videoUrl: 'https://www.youtube.com/embed/W0zLllV8b1c', duration: 1400 },
              { title: 'Encryption at Rest & In Transit', videoUrl: 'https://www.youtube.com/embed/9zUHg7xjIqQ', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: DevSecOps Pipeline',
            lectures: [
              { title: 'SAST/DAST trong CI/CD', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1300 },
              { title: 'Container Security: Docker, Kubernetes', videoUrl: 'https://www.youtube.com/embed/9zUHg7xjIqQ', duration: 1500 },
              { title: 'IaC Security: Terraform, CloudFormation', videoUrl: 'https://www.youtube.com/embed/W0zLllV8b1c', duration: 1200 },
            ],
          },
          {
            title: 'Chương 3: Dự án DevSecOps Pipeline',
            lectures: [
              { title: 'Thiết kế kiến trúc an toàn trên AWS', videoUrl: 'https://www.youtube.com/embed/9zUHg7xjIqQ', duration: 1400 },
              { title: 'Xây dựng CI/CD với Jenkins/GitLab CI', videoUrl: 'https://www.youtube.com/embed/ZtqBQ68AwJU', duration: 1600 },
              { title: 'Monitoring, SIEM & Incident Response', videoUrl: 'https://www.youtube.com/embed/W0zLllV8b1c', duration: 1300 },
            ],
          },
        ],
      },
    ],
  },
];

// ============================================================================
// 4. SEED FUNCTIONS
// ============================================================================

async function cleanupDatabase() {
  console.log('🧹 Đang dọn dẹp database...');
  const tables = [
    'ai_audit_logs', 'ai_messages', 'ai_conversations', 'ai_chunks',
    'ai_documents', 'ai_prompt_templates', 'ai_role_policies', 'ai_settings',
    'forum_reports', 'forum_posts', 'forum_topics', 'schedule_events',
    'attempts', 'questions', 'quizzes', 'payments', 'enrollments', 'reviews',
    'notifications', 'lectures', 'chapters', 'courses', 'categories', 'users',
  ];
  for (const table of tables) {
    try {
      await sequelize.query(`TRUNCATE TABLE "${table}" CASCADE`);
      console.log(`  ✓ Đã xóa: ${table}`);
    } catch (err) {
      console.log(`  ⚠️  ${table}: ${err.message}`);
    }
  }
  console.log('✅ Dọn dẹp hoàn tất');
}

async function createAdmin() {
  const { User } = models;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lms.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
  const adminName = process.env.ADMIN_NAME || 'Administrator';
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';

  const existingAdmin = await User.findOne({ where: { email: adminEmail } });
  if (existingAdmin) {
    console.log(`  ℹ️  Admin đã tồn tại: ${adminEmail}`);
    if (existingAdmin.role !== 'admin') {
      await existingAdmin.update({ role: 'admin' });
      console.log('  ✓ Đã cập nhật role thành admin');
    }
    return existingAdmin;
  }

  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  const admin = await User.create({
    name: adminName,
    email: adminEmail,
    passwordHash,
    role: 'admin',
    username: adminUsername,
    isActive: true,
    isEmailVerified: true,
  });
  console.log(`✅ Đã tạo admin: ${adminEmail}`);
  return admin;
}

async function createAiBot() {
  const { User } = models;
  const aiBotEmail = 'aibot@lms.com';
  const existing = await User.findOne({ where: { email: aiBotEmail } });
  if (existing) {
    console.log(`  ℹ️  AI Bot đã tồn tại (id=${existing.id})`);
    return existing;
  }
  const passwordHash = bcrypt.hashSync('AIBot_NoLogin_' + Math.random(), 10);
  const bot = await User.create({
    name: 'AI Trợ Giảng',
    email: aiBotEmail,
    passwordHash,
    role: 'admin',
    username: 'aibot',
    isActive: true,
    isEmailVerified: true,
  });
  console.log(`✅ Đã tạo AI Bot (id=${bot.id})`);
  return bot;
}

async function createTeachers() {
  const { User } = models;
  console.log('👨‍🏫 Đang tạo giảng viên...');
  const teachers = [];
  for (const t of TEACHERS) {
    let user = await User.findOne({ where: { email: t.email } });
    if (!user) {
      const passwordHash = bcrypt.hashSync('teacher123', 10);
      user = await User.create({
        name: t.name,
        email: t.email,
        username: t.username,
        passwordHash,
        role: 'teacher',
        avatar: t.avatar,
        bio: t.bio,
        isActive: true,
        isEmailVerified: true,
      });
      console.log(`  ✓ Giảng viên: ${t.name} (${t.specialty})`);
    } else {
      await user.update({ role: 'teacher', avatar: t.avatar, bio: t.bio });
      console.log(`  ✓ Cập nhật giảng viên: ${t.name}`);
    }
    teachers.push(user);
  }
  return teachers;
}

async function createCategories() {
  const { Category } = models;
  console.log('📂 Đang tạo categories...');
  const categories = [];
  let sortOrder = 1;
  for (const [name, meta] of Object.entries(CATEGORY_META)) {
    let cat = await Category.findOne({ where: { name } });
    if (!cat) {
      cat = await Category.create({
        name,
        description: meta.desc,
        icon: meta.icon,
        sortOrder: sortOrder++,
        isActive: true,
      });
      console.log(`  ✓ Category: ${name}`);
    } else {
      await cat.update({ description: meta.desc, icon: meta.icon, sortOrder: sortOrder++, isActive: true });
      console.log(`  ✓ Cập nhật Category: ${name}`);
    }
    categories.push(cat);
  }
  return categories;
}

async function createCoursesAndLectures(categories, teachers) {
  const { Course, Chapter, Lecture, Quiz, LearningPath, PathCourse } = models;
  console.log('📚 Đang tạo khóa học, chương & bài giảng...');
  let lectureCount = 0;

  const admin = await models.User.findOne({ where: { role: 'admin' } });
  const createdBy = admin?.id || null;
  const teacherMap = {};
  for (const t of teachers) {
    teacherMap[t.username] = t.id;
  }
  const categoryMap = {};
  for (const c of categories) {
    categoryMap[c.name] = c.id;
  }

  for (const catData of COURSES_DATA) {
    const categoryId = categoryMap[catData.category];
    const teacherId = teacherMap[catData.teacherUsername];

    if (!categoryId || !teacherId) {
      console.log(`  ⚠️  Bỏ qua ${catData.category}: thiếu category hoặc teacher`);
      continue;
    }

    let path = await LearningPath.findOne({ where: { categoryId } });
    if (!path) {
      path = await LearningPath.create({
        name: `Lộ trình ${catData.category}`,
        slug: `path-${catData.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        description: CATEGORY_META[catData.category].desc,
        categoryId,
        isActive: true,
      });
      console.log(`    ✓ LearningPath: ${path.name}`);
    }

    for (let i = 0; i < catData.courses.length; i++) {
      const courseInfo = catData.courses[i];
      const slug = `${categoryId}-${courseInfo.level}-${i + 1}`;

      let course = await Course.findOne({ where: { slug } });
      if (!course) {
        course = await Course.create({
          title: courseInfo.title,
          slug,
          description: courseInfo.description,
          imageUrl: courseInfo.thumbnail,
          level: courseInfo.level,
          categoryId,
          price: courseInfo.price,
          status: 'published',
          published: true,
          createdBy: teacherId,
          duration: courseInfo.duration,
          totalLessons: courseInfo.chapters.reduce((sum, ch) => sum + ch.lectures.length, 0),
        });
        console.log(`      ✓ Course: ${courseInfo.title}`);

        for (let chIndex = 0; chIndex < courseInfo.chapters.length; chIndex++) {
          const chInfo = courseInfo.chapters[chIndex];
          const chapter = await Chapter.create({
            title: chInfo.title,
            description: `Nội dung ${chInfo.title} - ${courseInfo.title}`,
            courseId: course.id,
            order: chIndex + 1,
          });

          for (let lecIndex = 0; lecIndex < chInfo.lectures.length; lecIndex++) {
            const lecInfo = chInfo.lectures[lecIndex];
            const safeUrl = SAFE_YOUTUBE_URLS[lectureCount % SAFE_YOUTUBE_URLS.length];
            lectureCount++;
            await Lecture.create({
              title: lecInfo.title,
              type: 'video',
              duration: lecInfo.duration,
              contentUrl: safeUrl,
              chapterId: chapter.id,
              order: lecIndex + 1,
              isPreview: lecIndex === 0,
            });
          }

          await Quiz.create({
            title: `Quiz ${chInfo.title}`,
            description: `Kiểm tra kiến thức ${chInfo.title} - ${courseInfo.title}`,
            passingScore: 70,
            timeLimit: 10,
            chapterId: chapter.id,
            courseId: course.id,
            status: 'published',
            createdBy: teacherId,
          });
        }
      } else {
        if (course.categoryId !== categoryId) {
          await course.update({ categoryId });
        }
      }

      const existingPathCourse = await PathCourse.findOne({
        where: { pathId: path.id, courseId: course.id },
      });
      if (!existingPathCourse) {
        await PathCourse.create({
          pathId: path.id,
          courseId: course.id,
          orderIndex: i,
          isRequired: true,
        });
        console.log(`      ✓ PathCourse: ${courseInfo.title} -> ${path.name}`);
      }
    }
  }
}

async function seed() {
  try {
    await connectDB();
    await sequelize.sync({ alter: false });

    await cleanupDatabase();
    await createAdmin();
    await createAiBot();
    const teachers = await createTeachers();
    const categories = await createCategories();
    await createCoursesAndLectures(categories, teachers);

    console.log('\n🎉 Seed-rich hoàn tất!');
    console.log(`   - ${TEACHERS.length} giảng viên`);
    console.log(`   - ${Object.keys(CATEGORY_META).length} categories`);
    console.log(`   - ${COURSES_DATA.reduce((sum, c) => sum + c.courses.length, 0)} khóa học`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed thất bại:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function autoSeed() {
  const shouldCleanup = process.env.CLEANUP_DB === 'true' || process.env.CLEANUP_DB === '1';
  if (shouldCleanup) await cleanupDatabase();
  await createAdmin();
  await createAiBot();
  const teachers = await createTeachers();
  const categories = await createCategories();
  await createCoursesAndLectures(categories, teachers);
}

if (require.main === module) {
  seed();
}

module.exports = { seed, autoSeed, cleanupDatabase, createAdmin, createAiBot };
