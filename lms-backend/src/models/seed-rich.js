const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { sequelize, connectDB, models } = require('./index');
const { recomputeCourseRating } = require('../services/courseAggregates.service');

// Danh sách video YouTube IDs (public/educational, chắc chắn embed được)
// Chỉ dùng video từ kênh lớn (freeCodeCamp 8M+ subs, CrashCourse) vì ít bị xóa
const DEMO_MP4_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
];

const getDemoVideoUrl = (index) => DEMO_MP4_VIDEOS[index % DEMO_MP4_VIDEOS.length];

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
              { title: 'Giới thiệu HTML & Công cụ cần thiết', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 900 },
              { title: 'HTML Tags cơ bản: headings, paragraphs, links', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1200 },
              { title: 'HTML Forms & Input Elements', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: CSS3 Styling & Layout',
            lectures: [
              { title: 'Selectors, Colors, Fonts & Box Model', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1300 },
              { title: 'Flexbox - Layout 1 chiều hiệu quả', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1400 },
              { title: 'CSS Grid - Layout 2 chiều mạnh mẽ', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1500 },
            ],
          },
          {
            title: 'Chương 3: Responsive Design & Project',
            lectures: [
              { title: 'Media Queries & Mobile-first', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
              { title: 'Xây dựng Portfolio Website hoàn chỉnh', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 2000 },
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
              { title: 'Variables, Data Types & Operators', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1100 },
              { title: 'Functions, Arrow Functions & Scope', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1200 },
              { title: 'Arrays, Objects & Destructuring', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1300 },
            ],
          },
          {
            title: 'Chương 2: DOM & Asynchronous JS',
            lectures: [
              { title: 'DOM Manipulation & Events', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1400 },
              { title: 'Fetch API, Promises & Async/Await', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1500 },
              { title: 'Event Loop & Microtasks', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 900 },
            ],
          },
          {
            title: 'Chương 3: Dự án Todo App',
            lectures: [
              { title: 'Thiết kế UI & Cấu trúc dữ liệu', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
              { title: 'Implement CRUD với LocalStorage', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1600 },
              { title: 'Deploy lên Vercel/Netlify', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 800 },
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
              { title: 'Components, Props, State & JSX', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1200 },
              { title: 'useEffect, useRef & Custom Hooks', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1400 },
              { title: 'Context API & useReducer', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: State Management & Routing',
            lectures: [
              { title: 'Redux Toolkit & RTK Query', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1600 },
              { title: 'React Router v6 - Navigation bảo mật', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án E-commerce Dashboard',
            lectures: [
              { title: 'Setup project với Vite + Tailwind', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 900 },
              { title: 'Product List, Filter & Pagination', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1800 },
              { title: 'Giỏ hàng, Checkout & Dark Mode', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1500 },
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
              { title: 'Cài đặt môi trường & Jupyter Notebook', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 800 },
              { title: 'Variables, Data Types & Control Flow', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
              { title: 'Functions, Modules & List Comprehension', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Data Analysis với Pandas',
            lectures: [
              { title: 'DataFrames, Series & Indexing', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
              { title: 'Filtering, GroupBy & Aggregation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1300 },
              { title: 'Merge, Join & Pivot Tables', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Phân tích Doanh thu',
            lectures: [
              { title: 'Đọc & làm sạch dataset cửa hàng', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
              { title: 'Trực quan hóa với Matplotlib', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1400 },
              { title: 'Xuất báo cáo & Insights', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 900 },
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
              { title: 'Giới thiệu ML & Pipeline cơ bản', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
              { title: 'Data Preprocessing & Feature Scaling', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
              { title: 'Train/Test Split & Cross-Validation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Supervised Learning Algorithms',
            lectures: [
              { title: 'Linear & Polynomial Regression', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1400 },
              { title: 'Logistic Regression & SVM', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1300 },
              { title: 'Decision Trees & Random Forest', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1500 },
            ],
          },
          {
            title: 'Chương 3: Dự án Dự đoán Giá Nhà',
            lectures: [
              { title: 'EDA & Feature Engineering', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1600 },
              { title: 'Model Selection & Hyperparameter Tuning', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1400 },
              { title: 'Đánh giá Model & Deploy', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1000 },
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
              { title: 'Tensors, Autograd & Optimizers', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
              { title: 'Building Neural Networks với nn.Module', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1400 },
              { title: 'Training Loop & GPU Acceleration', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: CNN & Computer Vision',
            lectures: [
              { title: 'Convolution, Pooling & BatchNorm', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1500 },
              { title: 'Transfer Learning với ResNet/EfficientNet', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1300 },
            ],
          },
          {
            title: 'Chương 3: NLP & Transformer',
            lectures: [
              { title: 'Word Embeddings & LSTM', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
              { title: 'Attention Mechanism & Transformer', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1600 },
              { title: 'Fine-tuning BERT cho tiếng Việt', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1800 },
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
              { title: 'Giao diện Figma & Công cụ cơ bản', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 900 },
              { title: 'Frames, Groups & Constraints', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
              { title: 'Components & Instances', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Auto Layout & Design Systems',
            lectures: [
              { title: 'Auto Layout - Responsive trong Figma', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1200 },
              { title: 'Variants & Interactive Components', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
              { title: 'Color Theory & Typography cho UI', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án App Đặt Vé Xem Phim',
            lectures: [
              { title: 'Wireframe & User Flow', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 900 },
              { title: 'Visual Design & Component Library', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1300 },
              { title: 'Prototype & Handoff cho Developer', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
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
              { title: 'User Interviews & Affinity Mapping', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
              { title: 'Surveys & Quantitative Analysis', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
              { title: 'Usability Testing & Heuristic Evaluation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1200 },
            ],
          },
          {
            title: 'Chương 2: Design Thinking Process',
            lectures: [
              { title: 'Empathize - Journey Map & Personas', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1100 },
              { title: 'Define - Problem Statements & HMW', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 900 },
              { title: 'Ideate & Prototype - Crazy 8s & Testing', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1300 },
            ],
          },
          {
            title: 'Chương 3: Dự án Cải thiện App Giao Hàng',
            lectures: [
              { title: 'Research & Phát hiện Pain Points', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
              { title: 'Redesign Checkout Flow & Tracking', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1400 },
              { title: 'A/B Testing & Iteration', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
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
              { title: '12 Principles of Animation áp dụng UI', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1100 },
              { title: 'Easing Curves & Timing Functions', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
              { title: 'Storytelling qua Motion', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1200 },
            ],
          },
          {
            title: 'Chương 2: After Effects cho UI',
            lectures: [
              { title: 'Shape Layers & Keyframes', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1300 },
              { title: 'Export Lottie JSON & Integration', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Fintech Animation Set',
            lectures: [
              { title: 'Onboarding Flow Animation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1200 },
              { title: 'Transaction Success & Error States', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1400 },
              { title: 'Dashboard Charts & Loading Skeleton', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
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
              { title: 'Hiểu cách Google Search hoạt động', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 900 },
              { title: 'Keyword Research với Ahrefs & Ubersuggest', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
              { title: 'On-Page SEO: Title, Meta, Heading', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Technical SEO & Content',
            lectures: [
              { title: 'Site Speed, Mobile-friendly & Core Web Vitals', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
              { title: 'Content Strategy & E-E-A-T', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1300 },
              { title: 'Internal Linking & Schema Markup', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 900 },
            ],
          },
          {
            title: 'Chương 3: Dự án SEO Blog 30 ngày',
            lectures: [
              { title: 'Audit website & Lập kế hoạch từ khóa', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1100 },
              { title: 'Viết bài chuẩn SEO & Track ranking', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1400 },
              { title: 'Backlink building & Đánh giá kết quả', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
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
              { title: 'Content Pillars & Editorial Calendar', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
              { title: 'Copywriting: Headlines, Hooks & CTA', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1200 },
              { title: 'Visual Content với Canva Pro', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 900 },
            ],
          },
          {
            title: 'Chương 2: Social Media Growth',
            lectures: [
              { title: 'TikTok Algorithm & Trend jacking', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1300 },
              { title: 'Instagram Reels & Facebook Ads cơ bản', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1100 },
              { title: 'LinkedIn B2B Content & Personal Branding', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án TikTok 10K Followers',
            lectures: [
              { title: 'Niche research & Content series', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
              { title: 'Quay & edit video với CapCut', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1400 },
              { title: 'Analytics, Iterate & Monetization', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
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
              { title: 'Campaign Structure & Keyword Match Types', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
              { title: 'Ad Copywriting & Quality Score', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
              { title: 'Conversion Tracking & Remarketing', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1300 },
            ],
          },
          {
            title: 'Chương 2: Facebook/Meta Ads',
            lectures: [
              { title: 'Pixel, Custom Audience & Lookalike', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1400 },
              { title: 'Creative Testing & CBO Strategy', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1200 },
              { title: 'Landing Page Optimization', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án Chiến dịch 50 Triệu',
            lectures: [
              { title: 'Lập ngân sách & Target audience', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
              { title: 'A/B test creative & bidding strategy', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1500 },
              { title: 'Báo cáo ROAS & Scale campaign', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
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
              { title: 'Lean Startup & Design Thinking', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
              { title: 'Customer Discovery & Problem Interview', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
              { title: 'Business Model Canvas thực hành', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: MVP & Traction',
            lectures: [
              { title: 'Xây dựng MVP với no-code tools', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1300 },
              { title: 'Growth Hacking & Acquisition Channels', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
              { title: 'Metrics: CAC, LTV, Churn, PMF', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Pitch & Fundraising',
            lectures: [
              { title: 'Storytelling & Pitch Deck Design', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
              { title: 'Định giá startup & Term Sheet', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
              { title: 'Demo Day & Q&A với Investor', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 900 },
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
              { title: 'Tuyển dụng & Onboarding hiệu quả', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1100 },
              { title: 'KPI, OKR & Performance Review', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
              { title: 'Văn hóa doanh nghiệp & Employee Engagement', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
            ],
          },
          {
            title: 'Chương 2: Finance & Operations',
            lectures: [
              { title: 'Kế toán cơ bản & Dòng tiền', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1300 },
              { title: 'Quản lý kho, chuỗi cung ứng & Logistics', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
              { title: 'Pháp lý, hợp đồng & Thuế cho SME', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án Tái cấu trúc Công ty',
            lectures: [
              { title: 'Audit quy trình hiện tại', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
              { title: 'Thiết kế workflow & Automation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1400 },
              { title: 'Đo lường hiệu quả sau tái cấu trúc', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
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
              { title: 'SWOT, PESTEL & Porter Five Forces', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1200 },
              { title: 'Blue Ocean Strategy & Value Innovation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1100 },
              { title: 'Competitive Advantage & Moat', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1300 },
            ],
          },
          {
            title: 'Chương 2: M&A & Due Diligence',
            lectures: [
              { title: 'M&A Process & Deal Structuring', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1400 },
              { title: 'Financial Due Diligence & Valuation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1200 },
              { title: 'Post-Merger Integration & Change Management', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án M&A Simulation',
            lectures: [
              { title: 'Chọn target & Phân tích synergy', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1300 },
              { title: 'Negotiation & Term Sheet', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1500 },
              { title: 'Integration roadmap & Risk assessment', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
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
              { title: 'IPA Sounds & Word Stress', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 900 },
              { title: 'Present Simple, Continuous & Past Simple', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
              { title: 'Question Forms & Short Answers', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Daily Communication',
            lectures: [
              { title: 'Greetings, Introductions & Small Talk', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1200 },
              { title: 'Shopping, Dining & Travel English', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
              { title: 'Phone Calls & Appointments', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Hội Thoại 5 phút',
            lectures: [
              { title: 'Luyện nghe qua TED-Ed & Podcasts', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1000 },
              { title: 'Shadowing & Recording bản thân', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1300 },
              { title: 'Live practice qua Cambly/HelloTalk', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 900 },
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
              { title: 'Listening Strategy & Note-taking', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
              { title: 'Reading: Skimming, Scanning & Keywords', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1400 },
              { title: 'True/False/Not Given & Matching Tricks', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Writing Band 7+',
            lectures: [
              { title: 'Task 1: Line, Bar, Pie, Map, Process', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1500 },
              { title: 'Task 2: Opinion, Discussion, Problem-Solution', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1300 },
              { title: 'Academic Vocabulary & Complex Sentences', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
            ],
          },
          {
            title: 'Chương 3: Speaking Fluency',
            lectures: [
              { title: 'Part 1: Hobbies, Work, Study - Natural Flow', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
              { title: 'Part 2: Cue Card & 2-minute Monologue', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1400 },
              { title: 'Part 3: Abstract Discussion & Opinion', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
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
              { title: 'Email Writing: Formal, Inquiry, Complaint', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
              { title: 'Meeting Language: Chairing, Minutes, Action items', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
              { title: 'Negotiation Phrases & Tactics', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Presentation & Report',
            lectures: [
              { title: 'Structuring Presentation & Slides', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1300 },
              { title: 'Data Description & Trend Language', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
              { title: 'Q&A Handling & Impromptu Speaking', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Thuyết Trình Business Case',
            lectures: [
              { title: 'Chọn case study & Research data', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
              { title: 'Viết script & Design slides chuyên nghiệp', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1400 },
              { title: 'Thuyết trình trước hội đồng & Feedback', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1200 },
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
              { title: 'Active Listening & Empathy', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 900 },
              { title: 'Non-verbal Communication & Body Language', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1100 },
              { title: 'Feedback: Giving & Receiving', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Public Speaking',
            lectures: [
              { title: 'Cấu trúc bài nói: Mở - Thân - Kết', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1200 },
              { title: 'Voice Control, Pause & Storytelling', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1000 },
              { title: 'Xử lý sự cố & Q&A tự tin', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Thuyết Trình 10 phút',
            lectures: [
              { title: 'Chọn chủ đề & Outline bài nói', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
              { title: 'Slide design & Rehearsal techniques', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1300 },
              { title: 'Record & Self-review trước audience', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 900 },
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
              { title: 'Belbin Team Roles & Self-assessment', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1000 },
              { title: 'Effective Meeting & Decision Making', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1100 },
              { title: 'Remote Teamwork & Async Communication', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Conflict Management',
            lectures: [
              { title: 'Thomas-Kilmann Conflict Mode', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1200 },
              { title: 'Difficult Conversations & Mediation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1300 },
              { title: 'Negotiation & Win-Win Solutions', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án Giải Quyết Xung Đột',
            lectures: [
              { title: 'Phân tích case study xung đột nhóm', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
              { title: 'Thiết kế giải pháp & Mediation plan', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1400 },
              { title: 'Role-play & Feedback từ mentor', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
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
              { title: 'Eisenhower Matrix & Pareto Principle', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 900 },
              { title: 'GTD: Capture, Clarify, Organize, Reflect', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1200 },
              { title: 'Time Blocking & Calendar Management', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 2: Deep Work & Habits',
            lectures: [
              { title: 'Deep Work vs Shallow Work', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1100 },
              { title: 'Eliminate Distraction: Digital Minimalism', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1300 },
              { title: 'Habit Stacking & Atomic Habits', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
            ],
          },
          {
            title: 'Chương 3: Dự án 30 Ngày Năng Suất',
            lectures: [
              { title: 'Audit thời gian hiện tại & Xác định mục tiêu', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1000 },
              { title: 'Thiết kế hệ thống cá nhân hóa', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
              { title: 'Tracking, Review & Iteration', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 900 },
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
              { title: 'OSI Model & TCP/IP Stack', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
              { title: 'IP Addressing, Subnetting & Routing', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1200 },
              { title: 'DNS, DHCP & NAT explained', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: Linux Essentials',
            lectures: [
              { title: 'Linux Distros & Terminal Basics', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
              { title: 'File System, Permissions & Users', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1300 },
              { title: 'Shell Scripting & Cron Jobs', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 3: Dự án LAMP Server',
            lectures: [
              { title: 'Cài đặt Ubuntu Server trên VPS', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1000 },
              { title: 'Cấu hình Apache, MySQL, PHP', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1400 },
              { title: 'Security hardening & Monitoring', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1000 },
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
              { title: 'Passive vs Active Reconnaissance', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1100 },
              { title: 'Nmap, Masscan & Service Enumeration', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1300 },
              { title: 'Vulnerability Scanning với Nessus/OpenVAS', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1200 },
            ],
          },
          {
            title: 'Chương 2: Web App Exploitation',
            lectures: [
              { title: 'OWASP Top 10: Injection & Broken Auth', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1400 },
              { title: 'XSS, CSRF & IDOR Exploitation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1300 },
              { title: 'Burp Suite: Proxy, Repeater, Intruder', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1200 },
            ],
          },
          {
            title: 'Chương 3: Dự án Pentest Web App',
            lectures: [
              { title: 'Scope definition & Rules of Engagement', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1000 },
              { title: 'Thực hiện pentest & Khai thác lỗ hổng', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1600 },
              { title: 'Viết báo cáo & Remediation plan', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1100 },
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
              { title: 'Shared Responsibility Model', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
              { title: 'IAM, VPC, Security Groups & NACLs', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1400 },
              { title: 'Encryption at Rest & In Transit', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1100 },
            ],
          },
          {
            title: 'Chương 2: DevSecOps Pipeline',
            lectures: [
              { title: 'SAST/DAST trong CI/CD', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1300 },
              { title: 'Container Security: Docker, Kubernetes', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', duration: 1500 },
              { title: 'IaC Security: Terraform, CloudFormation', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', duration: 1200 },
            ],
          },
          {
            title: 'Chương 3: Dự án DevSecOps Pipeline',
            lectures: [
              { title: 'Thiết kế kiến trúc an toàn trên AWS', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', duration: 1400 },
              { title: 'Xây dựng CI/CD với Jenkins/GitLab CI', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 1600 },
              { title: 'Monitoring, SIEM & Incident Response', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 1300 },
            ],
          },
        ],
      },
    ],
  },
];

// ============================================================================
// 3b. QUESTION TEMPLATES BY SUBJECT
// ============================================================================
const QT = (content, options, correctAnswer, points = 10) => ({ content, type: 'multiple_choice', options: JSON.stringify(options), correctAnswer, points });

const QUESTION_TEMPLATES = {
  html: [
    QT('Thẻ <header> trong HTML5 dùng để làm gì?',['A. Hiển thị phần đầu trang','B. Tạo tiêu đề lớn nhất','C. Chứa metadata','D. Tạo thanh điều hướng'],'A'),
    QT('Thẻ nào dùng để tạo liên kết trong HTML?',['A. <link>','B. <a>','C. <href>','D. <url>'],'B'),
    QT('Thuộc tính nào của <input> dùng để nhập email?',['A. type="email"','B. type="mail"','C. name="email"','D. pattern="email"'],'A'),
    QT('Thẻ nào định nghĩa nội dung chính của trang web?',['A. <section>','B. <main>','C. <article>','D. <div>'],'B'),
    QT('Thẻ <form> dùng để làm gì?',['A. Tạo bảng','B. Tạo biểu mẫu nhập liệu','C. Tạo danh sách','D. Tạo khung hình'],'B'),
  ],
  css: [
    QT('Thuộc tính nào thay đổi màu chữ trong CSS?',['A. text-color','B. font-color','C. color','D. foreground'],'C'),
    QT('Giá trị nào của display tạo layout 1 chiều linh hoạt?',['A. grid','B. block','C. flex','D. inline'],'C'),
    QT('justify-content: center dùng để làm gì?',['A. Căn giữa theo chiều dọc','B. Căn giữa theo chiều ngang','C. Căn trái','D. Căn phải'],'B'),
    QT('Thuộc tính nào tạo khoảng cách bên trong phần tử?',['A. margin','B. padding','C. border','D. spacing'],'B'),
    QT('CSS Grid dùng thuộc tính nào để chia cột?',['A. grid-template-columns','B. grid-columns','C. column-count','D. flex-columns'],'A'),
  ],
  responsive: [
    QT('Media queries trong CSS dùng để làm gì?',['A. Thêm âm thanh','B. Responsive theo kích thước màn hình','C. Tải video','D. Gửi tin nhắn'],'B'),
    QT('Mobile-first nghĩa là gì?',['A. Thiết kế cho mobile trước','B. Ưu tiên desktop','C. Chỉ hỗ trợ mobile','D. Không hỗ trợ tablet'],'A'),
    QT('Đơn vị nào phù hợp nhất cho responsive font size?',['A. px','B. rem/em','C. pt','D. cm'],'B'),
  ],
  javascript: [
    QT('let và const khác gì nhau?',['A. Không khác','B. const không thể gán lại','C. let không có scope','D. const là hàm'],'B'),
    QT('Arrow function có đặc điểm gì nổi bật?',['A. Không có this','B. Luôn async','C. Không nhận tham số','D. Chỉ dùng trong class'],'A'),
    QT('Destructuring trong JS dùng để làm gì?',['A. Rút gọn cú pháp trích xuất giá trị','B. Xóa biến','C. Tạo vòng lặp','D. Khai báo hàm'],'A'),
    QT('Promise có các trạng thái nào?',['A. pending, resolved, rejected','B. start, end, error','C. wait, done, fail','D. open, close, error'],'A'),
    QT('async/await là syntax sugar của gì?',['A. Callbacks','B. Promises','C. Events','D. Generators'],'B'),
  ],
  dom: [
    QT('document.querySelector dùng để làm gì?',['A. Chọn tất cả phần tử','B. Chọn phần tử đầu tiên khớp selector','C. Tạo phần tử mới','D. Xóa phần tử'],'B'),
    QT('addEventListener dùng để làm gì?',['A. Thêm style','B. Gắn sự kiện','C. Thêm class','D. Thêm thuộc tính'],'B'),
    QT('event.preventDefault() dùng để làm gì?',['A. Dừng animation','B. Ngăn hành vi mặc định','C. Xóa event','D. Tạo event mới'],'B'),
  ],
  react: [
    QT('useState trong React trả về gì?',['A. Một giá trị','B. Một mảng [state, setState]','C. Một hàm','D. Một object'],'B'),
    QT('JSX là gì?',['A. JavaScript XML','B. JSON extension','C. Java Syntax eXtension','D. Java Server eXtension'],'A'),
    QT('useEffect dùng để làm gì?',['A. Quản lý state','B. Xử lý side effects','C. Tạo component','D. Render UI'],'B'),
    QT('Props trong React là gì?',['A. Dữ liệu truyền từ cha xuống con','B. State nội bộ','C. Hàm callback','D. CSS class'],'A'),
    QT('Virtual DOM có tác dụng gì?',['A. Tăng tốc render','B. Giảm thao tác với DOM thật','C. Lưu trữ state','D. Quản lý routing'],'B'),
  ],
  redux: [
    QT('Redux store chứa gì?',['A. Toàn bộ state ứng dụng','B. Chỉ state local','C. CSS styles','D. API endpoints'],'A'),
    QT('Action trong Redux là gì?',['A. Mô tả sự kiện xảy ra','B. Hàm render','C. Component UI','D. Database query'],'A'),
    QT('Reducer trong Redux là gì?',['A. Hàm pure cập nhật state','B. Hàm gọi API','C. Component hiển thị','D. Middleware'],'A'),
  ],
  python: [
    QT('List comprehension trong Python dùng để làm gì?',['A. Tạo danh sách ngắn gọn','B. Sắp xếp list','C. Xóa phần tử','D. Đọc file'],'A'),
    QT('dict trong Python là kiểu dữ liệu gì?',['A. Danh sách','B. Từ điển key-value','C. Tuple','D. Set'],'B'),
    QT('Hàm nào đọc file trong Python?',['A. read()','B. open()','C. file()','D. load()'],'B'),
    QT('len() dùng để làm gì?',['A. Tính độ dài','B. Chuyển chữ hoa','C. Tạo số ngẫu nhiên','D. Cắt chuỗi'],'A'),
    QT('Module nào dùng để phân tích dữ liệu bảng?',['A. NumPy','B. Pandas','C. Matplotlib','D. Requests'],'B'),
  ],
  pandas: [
    QT('DataFrame trong Pandas là gì?',['A. Mảng 1 chiều','B. Bảng dữ liệu 2 chiều','C. Hình ảnh','D. File text'],'B'),
    QT('groupby() dùng để làm gì?',['A. Sắp xếp','B. Gom nhóm và tính toán','C. Lọc dữ liệu','D. Merge bảng'],'B'),
    QT('fillna() dùng để làm gì?',['A. Xóa dòng null','B. Thay thế giá trị null','C. Tìm max','D. Đổi tên cột'],'B'),
  ],
  'machine-learning': [
    QT('Overfitting là gì?',['A. Model quá khớp với training data','B. Model không học được','C. Lỗi dữ liệu','D. Chạy chậm'],'A'),
    QT('Train/Test Split dùng để làm gì?',['A. Đánh giá model trên unseen data','B. Tăng dữ liệu','C. Giảm noise','D. Chọn feature'],'A'),
    QT('Random Forest là gì?',['A. Một thuật toán ensemble','B. Một loại cây quyết định đơn','C. Mạng neural','D. K-means'],'A'),
    QT('Feature Scaling cần thiết vì sao?',['A. Các feature có đơn vị khác nhau','B. Giảm số feature','C. Tăng tốc độc lập','D. Tạo feature mới'],'A'),
    QT('Cross-validation dùng để làm gì?',['A. Đánh giá model ổn định hơn','B. Tăng data training','C. Giảm overfitting','D. Chọn thuật toán'],'A'),
  ],
  pytorch: [
    QT('Tensor trong PyTorch tương đương gì trong NumPy?',['A. DataFrame','B. ndarray','C. Series','D. dict'],'B'),
    QT('autograd trong PyTorch dùng để làm gì?',['A. Tự động tính gradient','B. Tự động lưu model','C. Tự động tải data','D. Tự động deploy'],'A'),
    QT('nn.Module dùng để làm gì?',['A. Định nghĩa neural network','B. Load dataset','C. Tối ưu optimizer','D. Vẽ biểu đồ'],'A'),
  ],
  figma: [
    QT('Auto Layout trong Figma dùng để làm gì?',['A. Tạo animation','B. Responsive layout tự động','C. Xuất code','D. Chụp màn hình'],'B'),
    QT('Component và Instance khác nhau thế nào?',['A. Instance kế thừa từ Component','B. Không khác','C. Component nhỏ hơn','D. Instance không chỉnh sửa được'],'A'),
    QT('Frame trong Figma tương đương gì?',['A. Artboard/Canvas','B. Layer','C. Group','D. Shape'],'A'),
  ],
  'ux-research': [
    QT('User Persona dùng để làm gì?',['A. Mô tả đại diện người dùng mục tiêu','B. Thiết kế UI','C. Viết code','D. Test hiệu năng'],'A'),
    QT('Journey Map thể hiện điều gì?',['A. Hành trình trải nghiệm người dùng','B. Bản đồ trang web','C. Sitemap','D. Wireframe'],'A'),
    QT('Usability Testing là gì?',['A. Kiểm tra khả năng sử dụng','B. Kiểm tra bảo mật','C. Kiểm tra tốc độ','D. Kiểm tra SEO'],'A'),
  ],
  seo: [
    QT('Backlink là gì?',['A. Liên kết từ trang khác trỏ về trang mình','B. Liên kết nội bộ','C. Liên kết hỏng','D. Link quảng cáo'],'A'),
    QT('Meta Description dùng để làm gì?',['A. Mô tả ngắn trong kết quả tìm kiếm','B. Tiêu đề trang','C. Từ khóa chính','D. URL ảnh'],'A'),
    QT('Keyword Stuffing là gì?',['A. Nhồi nhét từ khóa spam','B. Nghiên cứu từ khóa','C. Tối ưu từ khóa','D. Ẩn từ khóa'],'A'),
  ],
  'content-marketing': [
    QT('Content Pillars là gì?',['A. Chủ đề trụ cột của content strategy','B. Cột viết bài','C. Công cụ viết lách','D. Trang landing'],'A'),
    QT('Hook trong copywriting là gì?',['A. Câu mở đầu thu hút','B. Kết bài','C. Hashtag','D. CTA'],'A'),
    QT('CTA viết tắt của gì?',['A. Call To Action','B. Content Target Audience','C. Create Text Article','D. Content To Advertise'],'A'),
  ],
  'google-ads': [
    QT('Quality Score ảnh hưởng đến điều gì?',['A. Vị trí hiển thị & CPC','B. Chỉ số lượt xem','C. Thời gian quảng cáo','D. Độ tuổi người xem'],'A'),
    QT('Remarketing là gì?',['A. Quảng cáo lại cho người đã tương tác','B. Marketing lần đầu','C. Email marketing','D. SEO'],'A'),
    QT('Keyword Match Type nào chính xác nhất?',['A. Broad Match','B. Phrase Match','C. Exact Match','D. Negative Match'],'C'),
  ],
  'lean-startup': [
    QT('MVP là gì?',['A. Minimum Viable Product','B. Maximum Value Product','C. Marketing Value Plan','D. Most Viewed Product'],'A'),
    QT('Business Model Canvas gồm bao nhiêu khối?',['A. 7','B. 9','C. 12','D. 5'],'B'),
    QT('Product-Market Fit là gì?',['A. Sản phẩm phù hợp thị trường','B. Sản phẩm hoàn thiện','C. Chiến lược marketing','D. Định giá'],'A'),
  ],
  'business-management': [
    QT('KPI là gì?',['A. Key Performance Indicator','B. Knowledge Process Index','C. Keep Product Inventory','D. Key Product Idea'],'A'),
    QT('OKR khác gì so với KPI?',['A. OKR hướng đến mục tiêu đột phá','B. Không khác','C. OKR chỉ dùng cho cá nhân','D. KPI chỉ dùng cho doanh nghiệp'],'A'),
    QT('Churn Rate là gì?',['A. Tỷ lệ rời bỏ khách hàng','B. Tỷ lệ chuyển đổi','C. Lợi nhuận','D. Chi phí'],'A'),
  ],
  'ielts': [
    QT('IELTS Academic có bao nhiêu phần Listening?',['A. 3','B. 4','C. 5','D. 6'],'B'),
    QT('Task 2 Writing yêu cầu viết tối thiểu bao nhiêu từ?',['A. 150','B. 200','C. 250','D. 300'],'C'),
    QT('Skimming trong Reading là gì?',['A. Đọc lướt nắm ý chính','B. Đọc chi tiết','C. Tìm từ khóa','D. Dịch từng câu'],'A'),
  ],
  'business-english': [
    QT('"ASAP" viết tắt của gì?',['A. As Soon As Possible','B. At Some Any Place','C. Always Say A Promise','D. Ask Soon Ask Possible'],'A'),
    QT('Email formal thường bắt đầu bằng gì?',['A. Dear Mr./Ms.','B. Hi buddy','C. Yo','D. Hey there'],'A'),
    QT('"Please find attached" dùng khi nào?',['A. Gửi file đính kèm','B. Yêu cầu gặp mặt','C. Hẹn lịch họp','D. Từ chối đề nghị'],'A'),
  ],
  'communication-skills': [
    QT('Active Listening là gì?',['A. Lắng nghe chủ động và phản hồi','B. Nghe nhạc','C. Nghe passively','D. Ghi âm'],'A'),
    QT('Non-verbal Communication bao gồm gì?',['A. Ngôn ngữ cơ thể, ánh mắt, giọng điệu','B. Chỉ lời nói','C. Viết email','D. Đọc sách'],'A'),
    QT('Feedback SBI model là gì?',['A. Situation-Behavior-Impact','B. Say-Be-Impact','C. Strategy-Business-Impact','D. Situation-Body-Impact'],'A'),
  ],
  teamwork: [
    QT('Belbin Team Roles gồm mấy vai trò?',['A. 5','B. 7','C. 9','D. 12'],'C'),
    QT('Brainstorming quy tắc quan trọng nhất là gì?',['A. Không phán xét ý tưởng','B. Chỉ ý tưởng thực tế','C. Không ghi chép','D. Chỉ leader nói'],'A'),
    QT('Remote Teamwork cần công cụ gì quan trọng nhất?',['A. Giao tiếp async rõ ràng','B. Máy tính đắt tiền','C. Văn phòng sang trọng','D. Lịch trống'],'A'),
  ],
  'time-management': [
    QT('Eisenhower Matrix chia công việc thành mấy nhóm?',['A. 2','B. 3','C. 4','D. 5'],'C'),
    QT('Pomodoro Technique làm việc bao lâu rồi nghỉ?',['A. 25 phút làm, 5 phút nghỉ','B. 50 phút làm, 10 phút nghỉ','C. 1 tiếng làm, 15 phút nghỉ','D. 15 phút làm, 5 phút nghỉ'],'A'),
    QT('Deep Work theo Cal Newport là gì?',['A. Làm việc tập trung sâu không bị gián đoạn','B. Làm nhiều việc cùng lúc','C. Làm việc ban đêm','D. Làm việc nhóm'],'A'),
  ],
  networking: [
    QT('OSI Model có bao nhiêu tầng?',['A. 5','B. 6','C. 7','D. 8'],'C'),
    QT('TCP và UDP khác nhau thế nào?',['A. TCP có kiểm soát lỗi, UDP không','B. Không khác','C. UDP nhanh hơn TCP','D. Cả A và C'],'D'),
    QT('DNS dùng để làm gì?',['A. Phân giải tên miền thành IP','B. Mã hóa dữ liệu','C. Kiểm tra virus','D. Quản lý file'],'A'),
  ],
  linux: [
    QT('Lệnh nào liệt kê file trong Linux?',['A. dir','B. ls','C. list','D. show'],'B'),
    QT('chmod 755 nghĩa là gì?',['A. Owner đọc-ghi-thực thi, group/other đọc-thực thi','B. Tất cả đều đọc-ghi','C. Chỉ owner đọc','D. Không ai truy cập'],'A'),
    QT('cron job trong Linux là gì?',['A. Lập lịch chạy tác vụ tự động','B. Xem thời gian','C. Quản lý user','D. Cài đặt phần mềm'],'A'),
  ],
  'ethical-hacking': [
    QT('OWASP Top 10 là gì?',['A. Danh sách 10 lỗ hổng web phổ biến nhất','B. 10 công cụ hacking','C. 10 ngôn ngữ lập trình','D. 10 framework bảo mật'],'A'),
    QT('SQL Injection khai thác điều gì?',['A. Lỗi nhập liệu trong truy vấn SQL','B. Lỗi phần cứng','C. Lỗi mạng','D. Lỗi hệ điều hành'],'A'),
    QT('Burp Suite chủ yếu dùng để làm gì?',['A. Pentest ứng dụng web','B. Dọn rác hệ thống','C. Tối ưu database','D. Thiết kế UI'],'A'),
  ],
  'cloud-security': [
    QT('Shared Responsibility Model nghĩa là gì?',['A. CSP và khách hàng cùng chịu trách nhiệm bảo mật','B. Chỉ CSP chịu trách nhiệm','C. Chỉ khách hàng chịu trách nhiệm','D. Không ai chịu trách nhiệm'],'A'),
    QT('IAM trong cloud dùng để làm gì?',['A. Quản lý quyền truy cập','B. Lưu trữ file','C. Tính toán','D. Monitor network'],'A'),
    QT('Encryption at Rest là gì?',['A. Mã hóa dữ liệu khi lưu trữ','B. Mã hóa khi truyền tải','C. Xóa dữ liệu','D. Nén dữ liệu'],'A'),
  ],
  devsecops: [
    QT('SAST là gì?',['A. Static Application Security Testing','B. Server Auto Security Test','C. System Admin Security Tool','D. Secure API Scan Test'],'A'),
    QT('DevSecOps khác DevOps ở điểm nào?',['A. Tích hợp bảo mật vào pipeline','B. Không khác','C. Chỉ dùng cho mobile','D. Nhanh hơn DevOps'],'A'),
    QT('Container Security quan tâm điều gì?',['A. Bảo mật image và runtime','B. Chỉ bảo mật host','C. Chỉ bảo mật network','D. Không cần bảo mật'],'A'),
  ],
  general: [
    QT('Mục tiêu chính của khóa học này là gì?',['A. Cung cấp kiến thức nền tảng','B. Chỉ dạy lý thuyết','C. Không có mục tiêu cụ thể','D. Dành cho chuyên gia'],'A'),
    QT('Phương pháp học tập được khuyến khích trong khóa học là gì?',['A. Học thuộc lòng','B. Học kết hợp thực hành','C. Chỉ xem video','D. Đọc tài liệu'],'B'),
    QT('Yếu tố nào được coi là then chốt để thành công theo khóa học?',['A. Tài năng bẩm sinh','B. Sự kiên trì và luyện tập','C. May mắn','D. Quan hệ xã hội'],'B'),
    QT('Sau khi hoàn thành khóa học, học viên có thể làm gì?',['A. Áp dụng ngay vào công việc','B. Tiếp tục học nâng cao','C. Cả hai đều đúng','D. Chưa thể làm gì'],'C'),
    QT('Định hướng của khóa học này là gì?',['A. Thực tiễn và ứng dụng','B. Chỉ nghiên cứu lý thuyết','C. Không có định hướng','D. Chỉ để thi cử'],'A'),
  ],
};

function detectSubjects(courseTitle, chapterTitle) {
  const text = (courseTitle + ' ' + chapterTitle).toLowerCase();
  const subjects = [];
  if (text.includes('html')) subjects.push('html');
  if (text.includes('css')) subjects.push('css');
  if (text.includes('responsive')) subjects.push('responsive');
  if (text.includes('javascript') || text.includes('js') || text.includes('dom') || text.includes('async') || text.includes('event loop')) subjects.push('javascript');
  if (text.includes('dom manipulation')) subjects.push('dom');
  if (text.includes('react')) subjects.push('react');
  if (text.includes('redux')) subjects.push('redux');
  if (text.includes('python')) subjects.push('python');
  if (text.includes('pandas') || text.includes('data analysis')) subjects.push('pandas');
  if (text.includes('machine learning') || text.includes('ml ')) subjects.push('machine-learning');
  if (text.includes('deep learning') || text.includes('pytorch') || text.includes('neural') || text.includes('transformer')) subjects.push('pytorch');
  if (text.includes('figma') || text.includes('ui design')) subjects.push('figma');
  if (text.includes('ux') || text.includes('user research') || text.includes('design thinking')) subjects.push('ux-research');
  if (text.includes('animation') || text.includes('after effects') || text.includes('lottie')) subjects.push('figma');
  if (text.includes('seo')) subjects.push('seo');
  if (text.includes('content') || text.includes('social media') || text.includes('marketing')) subjects.push('content-marketing');
  if (text.includes('google ads')) subjects.push('google-ads');
  if (text.includes('facebook ads') || text.includes('meta ads')) subjects.push('google-ads');
  if (text.includes('startup') || text.includes('mvp')) subjects.push('lean-startup');
  if (text.includes('quản trị') || text.includes('business management') || text.includes('kpi') || text.includes('okr')) subjects.push('business-management');
  if (text.includes('m&a') || text.includes('merger') || text.includes('chiến lược')) subjects.push('business-management');
  if (text.includes('tiếng anh giao tiếp') || text.includes('communication') || text.includes('pronunciation')) subjects.push('communication-skills');
  if (text.includes('ielts')) subjects.push('ielts');
  if (text.includes('business english')) subjects.push('business-english');
  if (text.includes('giao tiếp') || text.includes('thuyết trình') || text.includes('public speaking')) subjects.push('communication-skills');
  if (text.includes('làm việc nhóm') || text.includes('teamwork') || text.includes('belbin')) subjects.push('teamwork');
  if (text.includes('xung đột') || text.includes('conflict')) subjects.push('teamwork');
  if (text.includes('quản lý thời gian') || text.includes('time management') || text.includes('productivity')) subjects.push('time-management');
  if (text.includes('mạng máy tính') || text.includes('networking') || text.includes('osi') || text.includes('tcp/ip')) subjects.push('networking');
  if (text.includes('linux')) subjects.push('linux');
  if (text.includes('hacking') || text.includes('penetration') || text.includes('pentest') || text.includes('owasp')) subjects.push('ethical-hacking');
  if (text.includes('cloud security') || text.includes('devsecops') || text.includes('iam')) subjects.push('cloud-security');
  if (text.includes('devsecops') || text.includes('ci/cd')) subjects.push('devsecops');
  if (subjects.length === 0) subjects.push('general');
  return subjects;
}

function pickQuestions(subjects, count) {
  const pool = [];
  for (const s of subjects) {
    const arr = QUESTION_TEMPLATES[s] || QUESTION_TEMPLATES['general'];
    if (arr) pool.push(...arr);
  }
  if (pool.length === 0) return QUESTION_TEMPLATES['general'];
  // Shuffle and pick
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function generateChapterQuestions(courseTitle, chapterTitle) {
  const subjects = detectSubjects(courseTitle, chapterTitle);
  return pickQuestions(subjects, 3);
}

function generateFinalQuestions(courseTitle, chapterTitles) {
  const allSubjects = new Set();
  for (const ct of chapterTitles) {
    detectSubjects(courseTitle, ct).forEach(s => allSubjects.add(s));
  }
  return pickQuestions([...allSubjects], 10);
}

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
  const { Course, Chapter, Lecture, Quiz, Question, LearningPath, PathCourse } = models;
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
            const demoUrl = DEMO_MP4_VIDEOS[lectureCount % DEMO_MP4_VIDEOS.length];
            lectureCount++;
            await Lecture.create({
              title: lecInfo.title,
              type: 'video',
              duration: lecInfo.duration,
              contentUrl: demoUrl,
              chapterId: chapter.id,
              order: lecIndex + 1,
              isPreview: lecIndex === 0,
            });
          }

          const chapterQuiz = await Quiz.create({
            title: `Quiz ${chInfo.title}`,
            description: `Kiểm tra kiến thức ${chInfo.title} - ${courseInfo.title}`,
            passingScore: 70,
            timeLimit: 10,
            chapterId: chapter.id,
            courseId: course.id,
            status: 'published',
            createdBy: teacherId,
            type: 'chapter',
          });

          // Add chapter-specific questions
          const chapterQuestions = generateChapterQuestions(courseInfo.title, chInfo.title);
          for (const q of chapterQuestions) {
            await Question.create({ quizId: chapterQuiz.id, ...q });
          }
        }
      } else {
        if (course.categoryId !== categoryId) {
          await course.update({ categoryId });
        }
      }

      // Create Final Exam for this course
      const finalExam = await Quiz.create({
        title: `Bài thi cuối kỳ - ${courseInfo.title}`,
        description: `Bài thi tổng hợp kiến thức toàn khóa ${courseInfo.title}. Bạn cần đạt ít nhất 70% để hoàn thành khóa học.`,
        passingScore: 70,
        timeLimit: 30,
        maxScore: 100,
        maxAttempts: 3,
        chapterId: null,
        courseId: course.id,
        status: 'published',
        createdBy: teacherId,
        type: 'final',
      });

      // Add 10 course-specific final exam questions
      const chapterTitles = courseInfo.chapters.map(ch => ch.title);
      const finalQuestions = generateFinalQuestions(courseInfo.title, chapterTitles);

      for (const q of finalQuestions) {
        await Question.create({ quizId: finalExam.id, ...q });
      }
      console.log(`      ✓ Final Exam: ${finalExam.title} (${finalQuestions.length} câu)`);

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

// ============================================================================
// 5. STUDENTS, ENROLLMENTS, PROGRESS & INTERACTIONS
// ============================================================================

const STUDENT_FIRST_NAMES = [
  'Nguyễn','Trần','Lê','Phạm','Hoàng','Vũ','Võ','Đặng','Bùi','Đỗ',
  'Hồ','Ngô','Dương','Lý','Phan','Trương','Đinh','Hà','Mai','Tô',
];
const STUDENT_MIDDLE_NAMES = [
  'Văn','Thị','Minh','Hoàng','Anh','Quốc','Thế','Hữu','Đình','Tuấn',
  'Thanh','Ngọc','Thùy','Mỹ','Bảo','Kim','Nhật','Gia','Tấn','Công',
];
const STUDENT_GIVEN_NAMES = [
  'An','Bình','Chi','Dũng','Em','Phương','Giang','Hà','Hùng','Hương',
  'Khang','Lan','Linh','Long','Mai','Nam','Ngọc','Nga','Nhi','Phúc',
  'Quân','Quỳnh','Sơn','Tâm','Thảo','Thi','Thùy','Trang','Tú','Tuấn',
  'Uyên','Vân','Việt','Vũ','Xuân','Yến','Anh','Bảo','Châu','Cường',
  'Đạt','Đức','Hạnh','Hiếu','Hoa','Huy','Khánh','Kiên','Lâm','Lộc',
  'Minh','Nhân','Nhung','Phong','Phú','Quang','Sang','Tài','Thắng','Thiên',
  'Thịnh','Thu','Thuy','Tiến','Trà','Trung','Tuyết','Vinh','Vũ','Vy',
];

function generateStudents(count) {
  const students = [];
  const usedEmails = new Set();
  for (let i = 0; i < count; i++) {
    const fn = STUDENT_FIRST_NAMES[i % STUDENT_FIRST_NAMES.length];
    const mn = STUDENT_MIDDLE_NAMES[Math.floor(Math.random() * STUDENT_MIDDLE_NAMES.length)];
    const gn = STUDENT_GIVEN_NAMES[Math.floor(Math.random() * STUDENT_GIVEN_NAMES.length)];
    const name = `${fn} ${mn} ${gn}`;
    const baseUsername = `${gn.toLowerCase()}${mn.toLowerCase().substring(0,1)}${i+1}`;
    const email = `${baseUsername}@student.lms.vn`;
    if (usedEmails.has(email)) continue;
    usedEmails.add(email);
    students.push({
      name,
      username: baseUsername,
      email,
      passwordHash: bcrypt.hashSync('student123', 10),
    });
  }
  return students;
}

async function createStudents() {
  const { User } = models;
  console.log('👨‍🎓 Đang tạo học viên...');
  const studentData = generateStudents(80);
  const students = [];
  for (const s of studentData) {
    let user = await User.findOne({ where: { email: s.email } });
    if (!user) {
      user = await User.create({
        name: s.name,
        email: s.email,
        username: s.username,
        passwordHash: s.passwordHash,
        role: 'student',
        isActive: true,
        isEmailVerified: true,
      });
    }
    students.push(user);
  }
  console.log(`  ✓ ${students.length} học viên đã tạo`);
  return students;
}

async function createEnrollmentsProgressAndAttempts(students) {
  const { Course, Chapter, Lecture, Quiz, Question, Enrollment, LectureProgress, Attempt, Payment } = models;
  console.log('📊 Đang tạo enrollments, tiến độ và bài làm...');

  const courses = await Course.findAll({ where: { status: 'published' } });
  let enrollmentCount = 0;
  let progressCount = 0;
  let attemptCount = 0;
  let paymentCount = 0;

  for (const course of courses) {
    // Get all lectures for this course
    const chapters = await Chapter.findAll({
      where: { courseId: course.id },
      include: [{ model: Lecture, as: 'lectures' }],
    });
    const allLectures = chapters.flatMap(ch => ch.lectures);
    allLectures.sort((a, b) => a.order - b.order);

    // Get all chapter quizzes and final exam for this course
    const quizzes = await Quiz.findAll({
      where: { courseId: course.id, status: 'published' },
      include: [{ model: Question, as: 'questions' }],
    });
    const chapterQuizzes = quizzes.filter(q => q.type === 'chapter');
    const finalExam = quizzes.find(q => q.type === 'final');

    // Determine how many students enroll in this course (10-40)
    const numEnroll = 10 + Math.floor(Math.random() * 31);
    const shuffled = [...students].sort(() => 0.5 - Math.random());
    const courseStudents = shuffled.slice(0, numEnroll);

    const progressBatch = [];
    const attemptBatch = [];
    const enrollmentUpdates = [];

    for (const student of courseStudents) {
      // Create enrollment
      const isPaid = Math.random() > 0.3;
      const [enrollment] = await Enrollment.findOrCreate({
        where: { userId: student.id, courseId: course.id },
        defaults: {
          userId: student.id,
          courseId: course.id,
          status: 'active',
          enrollmentType: isPaid ? 'paid' : 'free',
          progressPercent: 0,
          enrolledAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
          enrollmentStatus: 'active',
        },
      });
      enrollmentCount++;

      // Create completed payment for paid enrollments
      if (isPaid && course.price > 0) {
        try {
          await Payment.create({
            userId: student.id,
            courseId: course.id,
            amount: Number(course.price),
            currency: 'USD',
            provider: 'mock',
            providerTxn: `SEED-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`,
            status: 'completed',
            paymentDetails: {
              initiatedAt: enrollment.enrolledAt.toISOString(),
              processedAt: new Date().toISOString(),
              source: 'seed',
            },
          });
          paymentCount++;
        } catch (err) {
          // Ignore duplicate payment errors
        }
      }

      // Decide student completion level
      const rand = Math.random();
      let completedLectures = 0;
      let passedChapterQuizzes = 0;

      if (rand < 0.20) {
        completedLectures = allLectures.length;
      } else if (rand < 0.70) {
        completedLectures = Math.floor(allLectures.length * (0.3 + Math.random() * 0.6));
      } else if (rand < 0.90) {
        completedLectures = Math.min(3, Math.floor(Math.random() * 3) + 1);
      } else {
        completedLectures = 0;
      }

      // Build lecture progress batch
      for (let li = 0; li < allLectures.length; li++) {
        const lecture = allLectures[li];
        let watchedPercent = 0;
        let isCompleted = false;
        let completedAt = null;

        if (li < completedLectures) {
          watchedPercent = 95 + Math.floor(Math.random() * 6);
          isCompleted = true;
          completedAt = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
        } else if (li === completedLectures && completedLectures < allLectures.length) {
          watchedPercent = Math.floor(Math.random() * 60) + 10;
        }

        if (watchedPercent > 0) {
          progressBatch.push({
            userId: student.id,
            lectureId: lecture.id,
            courseId: course.id,
            watchedPercent,
            isCompleted,
            lastAccessedAt: new Date(),
            completedAt,
          });
        }
      }

      // Build quiz attempts batch
      for (const quiz of chapterQuizzes) {
        if (completedLectures > 0 && Math.random() > 0.3) {
          const pass = Math.random() > 0.35;
          const score = pass ? 70 + Math.floor(Math.random() * 31) : Math.floor(Math.random() * 65);
          attemptBatch.push({
            userId: student.id,
            quizId: quiz.id,
            score,
            percentageScore: score,
            passed: pass,
            answers: {},
            startedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          });
          if (pass) passedChapterQuizzes++;
        }
      }

      // Final exam attempt
      if (finalExam && completedLectures === allLectures.length) {
        const pass = Math.random() > 0.25;
        const score = pass ? 70 + Math.floor(Math.random() * 31) : Math.floor(Math.random() * 65);
        attemptBatch.push({
          userId: student.id,
          quizId: finalExam.id,
          score,
          percentageScore: score,
          passed: pass,
          answers: {},
          startedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
        });
      }

      // Track enrollment update
      const totalItems = allLectures.length + chapterQuizzes.length;
      const completedItems = completedLectures + passedChapterQuizzes;
      const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      enrollmentUpdates.push({ id: enrollment.id, progressPercent });
    }

    // Bulk insert progress & attempts for this course
    if (progressBatch.length > 0) {
      await LectureProgress.bulkCreate(progressBatch, { ignoreDuplicates: true });
      progressCount += progressBatch.length;
    }
    if (attemptBatch.length > 0) {
      await Attempt.bulkCreate(attemptBatch, { ignoreDuplicates: true });
      attemptCount += attemptBatch.length;
    }

    // Bulk update enrollments
    for (const up of enrollmentUpdates) {
      await Enrollment.update({ progressPercent: up.progressPercent }, { where: { id: up.id } });
    }

    console.log(`    ✓ ${course.title.slice(0, 40)}: ${courseStudents.length} enrollments`);
  }

  console.log(`  ✓ ${enrollmentCount} enrollments`);
  console.log(`  ✓ ${paymentCount} payments`);
  console.log(`  ✓ ${progressCount} lecture progress records`);
  console.log(`  ✓ ${attemptCount} quiz attempts`);
}

async function createReviews(students) {
  const { Course, Enrollment, Review } = models;
  console.log('⭐ Đang tạo đánh giá khóa học...');
  let reviewCount = 0;

  const courses = await Course.findAll({ where: { status: 'published' } });
  const reviewComments = [
    'Khóa học rất hay và bổ ích, giảng viên giảng dạy dễ hiểu. Tôi đã học được nhiều kiến thức mới.',
    'Nội dung khóa học phong phú, bài tập thực hành giúp tôi nắm vững kiến thức nhanh chóng.',
    'Một khóa học tuyệt vời! Rất đáng đồng tiền bát gạo.',
    'Giảng viên nhiệt tình, giải thích kỹ lưỡng. Tuy nhiên phần âm thanh video đôi khi không rõ.',
    'Khóa học phù hợp cho người mới bắt đầu, nội dung dễ theo dõi.',
    'Rất hài lòng với chất lượng khóa học. Tôi sẽ giới thiệu cho bạn bè.',
    'Nội dung hơi nhanh ở phần sau, nhưng nhìn chung rất tốt.',
    'Khóa học giúp tôi tự tin hơn khi áp dụng kiến thức vào thực tế.',
    'Tuyệt vời! Tôi đã hoàn thành khóa học và cảm thấy rất đáng.',
    'Cần thêm nhiều bài tập thực hành hơn nữa, nhưng nội dung rất chất lượng.',
    'Khóa học rất chi tiết, tôi đã học được nhiều điều mới mẻ.',
    'Giảng viên có chuyên môn cao, truyền đạt dễ hiểu. Rất recommend!',
  ];

  for (const course of courses) {
    // Find students who completed this course (enrollment progress >= 80%)
    const enrollments = await Enrollment.findAll({
      where: { courseId: course.id, progressPercent: { [require('sequelize').Op.gte]: 80 } },
    });
    const numReviews = Math.min(enrollments.length, Math.floor(Math.random() * 8) + 3);
    const shuffled = enrollments.sort(() => 0.5 - Math.random()).slice(0, numReviews);

    for (const en of shuffled) {
      try {
        await Review.create({
          userId: en.userId,
          courseId: course.id,
          rating: Math.floor(Math.random() * 3) + 3, // 3-5 stars
          comment: reviewComments[Math.floor(Math.random() * reviewComments.length)],
        });
        reviewCount++;
      } catch (err) {
        // Ignore duplicate review errors
      }
    }

    // Recompute course rating after creating reviews
    try {
      await recomputeCourseRating(course.id);
    } catch (err) {
      console.error(`  ⚠️ Failed to recompute rating for course ${course.id}:`, err.message);
    }
  }

  console.log(`  ✓ ${reviewCount} reviews`);
}

async function createForumData(students, teachers) {
  const { ForumTopic, ForumPost } = models;
  console.log('💬 Đang tạo dữ liệu diễn đàn...');

  const globalTopics = [
    { title: 'Chào mừng các bạn đến với cộng đồng học tập!', content: 'Mình rất vui được gặp các bạn ở đây. Hãy cùng nhau học tập và phát triển nhé!' },
    { title: 'Chia sẻ kinh nghiệm học online hiệu quả', content: 'Mọi người có tips gì để học online không bị mất tập trung không? Mình hay bị xao nhãng lắm.' },
    { title: 'Tìm bạn học nhóm lập trình Web', content: 'Mình đang học HTML/CSS và muốn tìm bạn cùng học để trao đổi. Ai quan tâm thì reply nhé!' },
    { title: 'Hỏi về chứng chỉ hoàn thành khóa học', content: 'Sau khi hoàn thành 100% khóa học thì mình nhận chứng chỉ ở đâu vậy các bạn?' },
    { title: 'Review khóa học JavaScript Modern ES6+', content: 'Mình vừa hoàn thành khóa học này. Nội dung rất chất lượng, giảng viên giảng rất kỹ về async/await và closure.' },
    { title: 'Góp ý cải thiện nền tảng E-Learning', content: 'Mình thấy nền tảng rất tốt rồi, nhưng nếu thêm tính năng ghi chú trong video thì tuyệt vời.' },
    { title: 'Kinh nghiệm chuẩn bị phỏng vấn Frontend Developer', content: 'Mình vừa pass phỏng vấn nhờ kiến thức từ các khóa học ở đây. Chia sẻ một chút tips cho các bạn.' },
    { title: 'Cần tư vấn chọn khóa học phù hợp', content: 'Mình đang phân vân giữa khóa React và Vue. Mọi người cho mình xin ý kiến với.' },
  ];

  let topicCount = 0;
  let postCount = 0;

  // Create global topics
  for (let i = 0; i < globalTopics.length; i++) {
    const author = i % 3 === 0 ? teachers[0] : students[Math.floor(Math.random() * students.length)];
    const topic = await ForumTopic.create({
      title: globalTopics[i].title,
      content: globalTopics[i].content,
      type: 'global',
      userId: author.id,
      views: Math.floor(Math.random() * 200) + 10,
      postCount: 0,
    });
    topicCount++;

    // Add 2-6 replies
    const numReplies = Math.floor(Math.random() * 5) + 2;
    for (let r = 0; r < numReplies; r++) {
      const replier = students[Math.floor(Math.random() * students.length)];
      await ForumPost.create({
        topicId: topic.id,
        userId: replier.id,
        content: `Mình đồng ý với ý kiến trên. ${globalTopics[i].title} là một chủ đề rất hay. Cảm ơn bạn đã chia sẻ!`,
        likes: Math.floor(Math.random() * 10),
      });
      postCount++;
    }
    await topic.update({ postCount: numReplies });
  }

  // Create some course-specific topics
  const { Course } = models;
  const courses = await Course.findAll({ where: { status: 'published' }, limit: 12 });
  for (const course of courses) {
    const topicAuthor = students[Math.floor(Math.random() * students.length)];
    const topic = await ForumTopic.create({
      title: `Thảo luận về khóa học: ${course.title}`,
      content: `Mọi người đang học khóa ${course.title} thấy thế nào? Mình đang gặp khó khăn ở phần bài tập thực hành.`,
      type: 'course',
      courseId: course.id,
      userId: topicAuthor.id,
      views: Math.floor(Math.random() * 100) + 5,
      postCount: 0,
    });
    topicCount++;

    const numReplies = Math.floor(Math.random() * 4) + 1;
    for (let r = 0; r < numReplies; r++) {
      const replier = students[Math.floor(Math.random() * students.length)];
      const replies = [
        'Mình cũng đang học khóa này, phần thực hành khá thú vị nhé. Cố lên!',
        'Khóa học này hay lắm, mình recommend bạn xem lại video bài giảng nhé.',
        'Mình đã hoàn thành khóa này rồi, nếu bạn cần hỗ trợ thì inbox mình nhé.',
        'Phần bài tập cuối chương hơi khó, nhưng làm xong thì hiểu sâu lắm.',
      ];
      await ForumPost.create({
        topicId: topic.id,
        userId: replier.id,
        content: replies[r % replies.length],
        likes: Math.floor(Math.random() * 8),
      });
      postCount++;
    }
    await topic.update({ postCount: numReplies });
  }

  console.log(`  ✓ ${topicCount} forum topics`);
  console.log(`  ✓ ${postCount} forum posts`);
}

async function seed() {
  try {
    await connectDB();
    console.log('🔄 Đang xoá và tạo lại tất cả bảng (force: true)...');
    await sequelize.sync({ force: true });
    console.log('✅ Database đã được reset');

    await createAdmin();
    await createAiBot();
    const teachers = await createTeachers();
    const categories = await createCategories();
    await createCoursesAndLectures(categories, teachers);

    // Student data & interactions
    const students = await createStudents();
    await createEnrollmentsProgressAndAttempts(students);
    await createReviews(students);
    await createForumData(students, teachers);

    console.log('\n🎉 Seed-rich hoàn tất!');
    console.log(`   - 1 admin`);
    console.log(`   - 1 AI Bot`);
    console.log(`   - ${TEACHERS.length} giảng viên`);
    console.log(`   - ${Object.keys(CATEGORY_META).length} categories`);
    console.log(`   - ${COURSES_DATA.reduce((sum, c) => sum + c.courses.length, 0)} khóa học`);
    console.log(`   - ${students.length} học viên`);
    console.log(`   - Enrollments, tiến độ, bài làm, reviews & forum đã được seed`);
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
