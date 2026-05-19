require('dotenv').config();
const { sequelize } = require('./index');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const QUIZZES = [
  {
    level: 'A1',
    title: 'Bài kiểm tra cuối trình độ A1',
    description: 'Đánh giá kỹ năng tiếng Anh cơ bản (Beginner)',
    maxScore: 100, timeLimit: 60, passingScore: 70,
  },
  {
    level: 'A2',
    title: 'Bài kiểm tra cuối trình độ A2',
    description: 'Đánh giá kỹ năng tiếng Anh sơ cấp (Elementary)',
    maxScore: 100, timeLimit: 60, passingScore: 70,
  },
  {
    level: 'B1',
    title: 'Bài kiểm tra cuối trình độ B1',
    description: 'Đánh giá kỹ năng tiếng Anh trung cấp (Intermediate)',
    maxScore: 100, timeLimit: 75, passingScore: 70,
  },
  {
    level: 'B2',
    title: 'Bài kiểm tra cuối trình độ B2',
    description: 'Đánh giá kỹ năng tiếng Anh trung cấp cao (Upper-Intermediate)',
    maxScore: 100, timeLimit: 75, passingScore: 70,
  },
  {
    level: 'C1',
    title: 'Bài kiểm tra cuối trình độ C1',
    description: 'Đánh giá kỹ năng tiếng Anh cao cấp (Advanced)',
    maxScore: 100, timeLimit: 90, passingScore: 70,
  },
  {
    level: 'C2',
    title: 'Bài kiểm tra cuối trình độ C2',
    description: 'Đánh giá kỹ năng tiếng Anh thành thạo (Proficiency)',
    maxScore: 100, timeLimit: 90, passingScore: 70,
  },
];

// 20 questions per level
const QUESTIONS = {
  A1: [
    { type: 'multiple_choice', content: 'What color is the sky on a clear day?', options: ['Red', 'Blue', 'Green', 'Yellow'], correctAnswer: 'Blue', points: 5 },
    { type: 'multiple_choice', content: 'Choose the correct greeting: "_____ morning!"', options: ['Good', 'Nice', 'Happy', 'Best'], correctAnswer: 'Good', points: 5 },
    { type: 'multiple_choice', content: 'How many days are in a week?', options: ['Five', 'Six', 'Seven', 'Eight'], correctAnswer: 'Seven', points: 5 },
    { type: 'multiple_choice', content: 'I _____ a student.', options: ['am', 'is', 'are', 'be'], correctAnswer: 'am', points: 5 },
    { type: 'multiple_choice', content: 'She _____ to the park every Sunday.', options: ['go', 'goes', 'going', 'gone'], correctAnswer: 'goes', points: 5 },
    { type: 'multiple_choice', content: 'What is the opposite of "hot"?', options: ['Warm', 'Cold', 'Boiling', 'Sunny'], correctAnswer: 'Cold', points: 5 },
    { type: 'multiple_choice', content: 'Choose the number: "3"', options: ['Two', 'Three', 'Four', 'Five'], correctAnswer: 'Three', points: 5 },
    { type: 'multiple_choice', content: 'The cat is _____ the table.', options: ['on', 'in', 'at', 'to'], correctAnswer: 'on', points: 5 },
    { type: 'multiple_choice', content: 'I like to eat _____.', options: ['book', 'apple', 'pen', 'shoe'], correctAnswer: 'apple', points: 5 },
    { type: 'true_false', content: '"Tuesday" comes before "Monday".', options: ['True', 'False'], correctAnswer: 'False', points: 5 },
    { type: 'multiple_choice', content: 'He _____ English very well.', options: ['speak', 'speaks', 'speaking', 'spoke'], correctAnswer: 'speaks', points: 5 },
    { type: 'multiple_choice', content: 'We _____ in Vietnam.', options: ['live', 'lives', 'living', 'lived'], correctAnswer: 'live', points: 5 },
    { type: 'multiple_choice', content: 'What time is it? It is 12:00.', options: ['Midnight', 'Noon', 'Morning', 'Evening'], correctAnswer: 'Noon', points: 5 },
    { type: 'multiple_choice', content: 'My brother _____ a car.', options: ['have', 'has', 'had', 'having'], correctAnswer: 'has', points: 5 },
    { type: 'multiple_choice', content: 'Choose the correct article: I have _____ apple.', options: ['a', 'an', 'the', '—'], correctAnswer: 'an', points: 5 },
    { type: 'true_false', content: '"Elephant" is smaller than "mouse".', options: ['True', 'False'], correctAnswer: 'False', points: 5 },
    { type: 'multiple_choice', content: 'They _____ football now.', options: ['play', 'plays', 'are playing', 'played'], correctAnswer: 'are playing', points: 5 },
    { type: 'multiple_choice', content: 'Can you _____ me your pen?', options: ['borrow', 'lend', 'take', 'get'], correctAnswer: 'lend', points: 5 },
    { type: 'multiple_choice', content: 'I _____ breakfast at 7:00 AM.', options: ['have', 'has', 'had', 'having'], correctAnswer: 'have', points: 5 },
    { type: 'short_answer', content: 'Write the past tense of "go": _____', correctAnswer: 'went', points: 5 },
  ],
  A2: [
    { type: 'multiple_choice', content: 'I _____ to the cinema yesterday.', options: ['go', 'went', 'gone', 'going'], correctAnswer: 'went', points: 5 },
    { type: 'multiple_choice', content: 'She has lived here _____ 2010.', options: ['for', 'since', 'from', 'in'], correctAnswer: 'since', points: 5 },
    { type: 'multiple_choice', content: 'If it rains, I _____ at home.', options: ['stay', 'will stay', 'stayed', 'staying'], correctAnswer: 'will stay', points: 5 },
    { type: 'multiple_choice', content: 'The coffee was _____ hot to drink.', options: ['very', 'too', 'much', 'enough'], correctAnswer: 'too', points: 5 },
    { type: 'multiple_choice', content: 'He is interested _____ learning French.', options: ['on', 'in', 'at', 'for'], correctAnswer: 'in', points: 5 },
    { type: 'multiple_choice', content: 'Choose the correct word: I am _____ than my brother.', options: ['tall', 'taller', 'tallest', 'more tall'], correctAnswer: 'taller', points: 5 },
    { type: 'true_false', content: '"Good" is the comparative form of "well".', options: ['True', 'False'], correctAnswer: 'False', points: 5 },
    { type: 'multiple_choice', content: 'They _____ to Paris twice.', options: ['have been', 'has been', 'are', 'were'], correctAnswer: 'have been', points: 5 },
    { type: 'multiple_choice', content: 'I _____ a book when she called.', options: ['read', 'was reading', 'am reading', 'have read'], correctAnswer: 'was reading', points: 5 },
    { type: 'multiple_choice', content: 'We arrived _____ the airport at 6 PM.', options: ['to', 'in', 'at', 'on'], correctAnswer: 'at', points: 5 },
    { type: 'multiple_choice', content: 'She _____ her leg while skiing.', options: ['breaks', 'broke', 'broken', 'breaking'], correctAnswer: 'broke', points: 5 },
    { type: 'multiple_choice', content: 'There is _____ milk in the fridge.', options: ['a few', 'few', 'a little', 'many'], correctAnswer: 'a little', points: 5 },
    { type: 'multiple_choice', content: 'I look forward _____ you soon.', options: ['see', 'to see', 'seeing', 'to seeing'], correctAnswer: 'to seeing', points: 5 },
    { type: 'multiple_choice', content: '"The weather is _____ than yesterday."', options: ['bad', 'worse', 'worst', 'badder'], correctAnswer: 'worse', points: 5 },
    { type: 'multiple_choice', content: 'By next year, I _____ my degree.', options: ['will finish', 'will have finished', 'have finished', 'finish'], correctAnswer: 'will have finished', points: 5 },
    { type: 'true_false', content: '"Advice" is a countable noun.', options: ['True', 'False'], correctAnswer: 'False', points: 5 },
    { type: 'multiple_choice', content: 'The movie was _____ boring that I fell asleep.', options: ['so', 'such', 'very', 'too'], correctAnswer: 'so', points: 5 },
    { type: 'multiple_choice', content: 'She asked me where I _____ from.', options: ['am', 'was', 'were', 'be'], correctAnswer: 'was', points: 5 },
    { type: 'multiple_choice', content: 'I haven\'t seen him _____ last Christmas.', options: ['for', 'since', 'from', 'by'], correctAnswer: 'since', points: 5 },
    { type: 'short_answer', content: 'Write the comparative form of "happy": _____', correctAnswer: 'happier', points: 5 },
  ],
  B1: [
    { type: 'multiple_choice', content: 'If I _____ rich, I would travel the world.', options: ['am', 'were', 'was', 'be'], correctAnswer: 'were', points: 5 },
    { type: 'multiple_choice', content: 'She denied _____ the money.', options: ['steal', 'to steal', 'stealing', 'stolen'], correctAnswer: 'stealing', points: 5 },
    { type: 'multiple_choice', content: 'By the time we arrived, the film _____.', options: ['started', 'had started', 'has started', 'was starting'], correctAnswer: 'had started', points: 5 },
    { type: 'multiple_choice', content: 'I wish I _____ more time to study.', options: ['have', 'had', 'have had', 'would have'], correctAnswer: 'had', points: 5 },
    { type: 'multiple_choice', content: 'The book is worth _____.', options: ['read', 'to read', 'reading', 'to be read'], correctAnswer: 'reading', points: 5 },
    { type: 'multiple_choice', content: 'He suggested _____ a taxi.', options: ['to take', 'taking', 'take', 'taken'], correctAnswer: 'taking', points: 5 },
    { type: 'true_false', content: '"Used to doing" and "used to do" have the same meaning.', options: ['True', 'False'], correctAnswer: 'False', points: 5 },
    { type: 'multiple_choice', content: 'Despite _____ hard, he failed the exam.', options: ['study', 'to study', 'studying', 'studied'], correctAnswer: 'studying', points: 5 },
    { type: 'multiple_choice', content: 'I can\'t help _____ about her.', options: ['worry', 'to worry', 'worrying', 'worried'], correctAnswer: 'worrying', points: 5 },
    { type: 'multiple_choice', content: 'It\'s high time we _____.', options: ['leave', 'left', 'have left', 'leaving'], correctAnswer: 'left', points: 5 },
    { type: 'multiple_choice', content: 'Not only _____ English, but she also speaks French.', options: ['she speaks', 'does she speak', 'she does speak', 'speaks she'], correctAnswer: 'does she speak', points: 5 },
    { type: 'multiple_choice', content: 'The painting _____ for $1 million.', options: ['sold', 'was sold', 'is selling', 'has sold'], correctAnswer: 'was sold', points: 5 },
    { type: 'multiple_choice', content: 'I\'d rather you _____ so loudly.', options: ['don\'t speak', 'didn\'t speak', 'not speak', 'wouldn\'t speak'], correctAnswer: 'didn\'t speak', points: 5 },
    { type: 'multiple_choice', content: 'Hardly _____ when the phone rang.', options: ['I had arrived', 'had I arrived', 'I arrived', 'did I arrive'], correctAnswer: 'had I arrived', points: 5 },
    { type: 'multiple_choice', content: 'The suspect is believed _____ the crime.', options: ['to commit', 'committing', 'to have committed', 'having committed'], correctAnswer: 'to have committed', points: 5 },
    { type: 'true_false', content: '"However" can be used at the beginning of a sentence with a comma.', options: ['True', 'False'], correctAnswer: 'True', points: 5 },
    { type: 'multiple_choice', content: 'No sooner _____ than the lights went out.', options: ['had I spoken', 'I had spoken', 'did I speak', 'I spoke'], correctAnswer: 'had I spoken', points: 5 },
    { type: 'multiple_choice', content: 'She prefers tea _____ coffee.', options: ['than', 'to', 'over', 'against'], correctAnswer: 'to', points: 5 },
    { type: 'multiple_choice', content: 'It was _____ a boring film that we left early.', options: ['so', 'such', 'very', 'too'], correctAnswer: 'such', points: 5 },
    { type: 'short_answer', content: 'Complete: "If I had known, I _____ (tell) you."', correctAnswer: 'would have told', points: 5 },
  ],
  B2: [
    { type: 'multiple_choice', content: 'Had I known the truth, I _____ differently.', options: ['would act', 'would have acted', 'had acted', 'acted'], correctAnswer: 'would have acted', points: 5 },
    { type: 'multiple_choice', content: 'The project is _____ to be finished by Friday.', options: ['bound', 'sure', 'certain', 'meant'], correctAnswer: 'bound', points: 5 },
    { type: 'multiple_choice', content: 'She made me _____ the entire report again.', options: ['rewrite', 'to rewrite', 'rewriting', 'rewritten'], correctAnswer: 'rewrite', points: 5 },
    { type: 'multiple_choice', content: 'Never before _____ such a beautiful sunset.', options: ['I saw', 'did I see', 'have I seen', 'had I seen'], correctAnswer: 'have I seen', points: 5 },
    { type: 'multiple_choice', content: 'The rumor _____ that the CEO would resign.', options: ['went around', 'went on', 'went off', 'went out'], correctAnswer: 'went around', points: 5 },
    { type: 'multiple_choice', content: 'He _____ have stolen the money; he was with me all day.', options: ['mustn\'t', 'can\'t', 'shouldn\'t', 'mightn\'t'], correctAnswer: 'can\'t', points: 5 },
    { type: 'true_false', content: '"Seldom" can trigger inversion in English.', options: ['True', 'False'], correctAnswer: 'True', points: 5 },
    { type: 'multiple_choice', content: 'I can\'t stand _____ in queues.', options: ['wait', 'to wait', 'waiting', 'waited'], correctAnswer: 'waiting', points: 5 },
    { type: 'multiple_choice', content: 'She turned _____ the offer because of the low salary.', options: ['down', 'up', 'out', 'over'], correctAnswer: 'down', points: 5 },
    { type: 'multiple_choice', content: 'The company is _____ the verge of bankruptcy.', options: ['on', 'in', 'at', 'by'], correctAnswer: 'on', points: 5 },
    { type: 'multiple_choice', content: 'If only he _____ listened to my advice!', options: ['would', 'had', 'has', 'did'], correctAnswer: 'had', points: 5 },
    { type: 'multiple_choice', content: 'The meeting was called _____ due to the storm.', options: ['off', 'out', 'away', 'up'], correctAnswer: 'off', points: 5 },
    { type: 'multiple_choice', content: 'She has an _____ for languages.', options: ['aptitude', 'attitude', 'altitude', 'latitude'], correctAnswer: 'aptitude', points: 5 },
    { type: 'multiple_choice', content: 'He came _____ a rare antique at the flea market.', options: ['across', 'over', 'into', 'up with'], correctAnswer: 'across', points: 5 },
    { type: 'multiple_choice', content: 'The law needs to be _____ to modern times.', options: ['adapted', 'adopted', 'adept', 'adjoin'], correctAnswer: 'adapted', points: 5 },
    { type: 'true_false', content: '"Accuse" is followed by the preposition "of".', options: ['True', 'False'], correctAnswer: 'True', points: 5 },
    { type: 'multiple_choice', content: 'Not until she arrived _____ we start.', options: ['could', 'we could', 'did', 'did we'], correctAnswer: 'could', points: 5 },
    { type: 'multiple_choice', content: 'They pulled _____ of the deal at the last minute.', options: ['out', 'off', 'away', 'over'], correctAnswer: 'out', points: 5 },
    { type: 'multiple_choice', content: 'He has a reputation _____ being punctual.', options: ['for', 'of', 'in', 'with'], correctAnswer: 'for', points: 5 },
    { type: 'short_answer', content: 'Complete: "I\'d sooner _____ (die) than apologize."', correctAnswer: 'die', points: 5 },
  ],
  C1: [
    { type: 'multiple_choice', content: 'Rarely _____ a writer of such brilliance.', options: ['one encounters', 'does one encounter', 'encounters one', 'one does encounter'], correctAnswer: 'does one encounter', points: 5 },
    { type: 'multiple_choice', content: 'The government is _____ to pressure from lobbyists.', options: ['prone', 'liable', 'subject', 'susceptible'], correctAnswer: 'prone', points: 5 },
    { type: 'multiple_choice', content: 'She _____ the rules to suit her own needs.', options: ['bent', 'broke', 'twisted', 'warped'], correctAnswer: 'bent', points: 5 },
    { type: 'multiple_choice', content: 'The theory lacks any _____ evidence.', options: ['empirical', 'imperial', 'practical', 'theoretical'], correctAnswer: 'empirical', points: 5 },
    { type: 'multiple_choice', content: 'I resent _____ to justify my every action.', options: ['having', 'to have', 'have', 'had'], correctAnswer: 'having', points: 5 },
    { type: 'multiple_choice', content: 'Such _____ the case that we had to postpone.', options: ['was', 'were', 'is', 'are'], correctAnswer: 'was', points: 5 },
    { type: 'true_false', content: '"Subjunctive" mood is frequently used in formal English.', options: ['True', 'False'], correctAnswer: 'True', points: 5 },
    { type: 'multiple_choice', content: 'The court _____ him of all charges.', options: ['acquitted', 'absolved', 'exempted', 'pardoned'], correctAnswer: 'acquitted', points: 5 },
    { type: 'multiple_choice', content: 'He is _____ to bursts of anger.', options: ['prone', 'liable', 'subject', 'inclined'], correctAnswer: 'prone', points: 5 },
    { type: 'multiple_choice', content: 'Should you change your mind, let me _____.', options: ['to know', 'know', 'knowing', 'knew'], correctAnswer: 'know', points: 5 },
    { type: 'multiple_choice', content: 'The report was _____ with errors.', options: ['rife', 'full', 'plenty', 'abundant'], correctAnswer: 'rife', points: 5 },
    { type: 'multiple_choice', content: 'I can\'t quite _____ out what he means.', options: ['make', 'figure', 'think', 'find'], correctAnswer: 'figure', points: 5 },
    { type: 'multiple_choice', content: 'She dismissed the claim as a(n) _____ argument.', options: ['fallacious', 'fictitious', 'fallible', 'frivolous'], correctAnswer: 'fallacious', points: 5 },
    { type: 'multiple_choice', content: 'The regime _____ down on all forms of dissent.', options: ['cracked', 'came', 'broke', 'went'], correctAnswer: 'cracked', points: 5 },
    { type: 'multiple_choice', content: 'He made a(n) _____ attempt to mediate.', options: ['futile', 'fertile', 'fatal', 'fateful'], correctAnswer: 'futile', points: 5 },
    { type: 'true_false', content: '"Were I you" is a correct inversion in conditional sentences.', options: ['True', 'False'], correctAnswer: 'True', points: 5 },
    { type: 'multiple_choice', content: 'The treaty was _____ by both nations.', options: ['ratified', 'rectified', 'justified', 'verified'], correctAnswer: 'ratified', points: 5 },
    { type: 'multiple_choice', content: 'Little _____ that he was being watched.', options: ['he knew', 'did he know', 'knew he', 'he did know'], correctAnswer: 'did he know', points: 5 },
    { type: 'multiple_choice', content: 'The novel is an _____ of colonialism.', options: ['indictment', 'accusation', 'impeachment', 'arraignment'], correctAnswer: 'indictment', points: 5 },
    { type: 'short_answer', content: 'Complete: "If he were to resign, it _____ (be) a disaster."', correctAnswer: 'would be', points: 5 },
  ],
  C2: [
    { type: 'multiple_choice', content: 'Nowhere _____ his artistic legacy more evident.', options: ['is', 'was', 'does', 'has'], correctAnswer: 'is', points: 5 },
    { type: 'multiple_choice', content: 'The philosopher\'s argument was _____ and unassailable.', options: ['cogent', 'coherent', 'cohesive', 'complicit'], correctAnswer: 'cogent', points: 5 },
    { type: 'multiple_choice', content: 'She _____ his reputation by association.', options: ['tarnished', 'tainted', 'besmirched', 'all of the above'], correctAnswer: 'all of the above', points: 5 },
    { type: 'multiple_choice', content: 'The _____ of his argument was its emotional appeal.', options: ['linchpin', 'cornerstone', 'keystone', 'lynchpin'], correctAnswer: 'linchpin', points: 5 },
    { type: 'multiple_choice', content: 'He _____ the contract after reading the fine print.', options: ['repudiated', 'refuted', 'rebutted', 'rebuffed'], correctAnswer: 'repudiated', points: 5 },
    { type: 'multiple_choice', content: 'The _____ of the novel is its narrative structure.', options: ['tour de force', 'fait accompli', 'cri de coeur', 'bet noir'], correctAnswer: 'tour de force', points: 5 },
    { type: 'true_false', content: '"I should have thought" can express surprise in British English.', options: ['True', 'False'], correctAnswer: 'True', points: 5 },
    { type: 'multiple_choice', content: 'The minister was _____ for misconduct.', options: ['censured', 'censored', 'censured', 'sensor'], correctAnswer: 'censured', points: 5 },
    { type: 'multiple_choice', content: 'Only by working together _____ we succeed.', options: ['can', 'could', 'may', 'shall'], correctAnswer: 'can', points: 5 },
    { type: 'multiple_choice', content: 'The evidence was _____ at best.', options: ['tenuous', 'tentative', 'tendentious', 'tenable'], correctAnswer: 'tenuous', points: 5 },
    { type: 'multiple_choice', content: 'He _____ his privilege with great responsibility.', options: ['wielded', 'brandished', 'flourished', 'swung'], correctAnswer: 'wielded', points: 5 },
    { type: 'multiple_choice', content: 'The speaker delivered a(n) _____ on the state of education.', options: ['jeremiad', 'homily', 'polemic', 'treatise'], correctAnswer: 'jeremiad', points: 5 },
    { type: 'multiple_choice', content: 'She wrote with great _____ and subtlety.', options: ['nuance', 'novelty', 'nascence', 'nuisance'], correctAnswer: 'nuance', points: 5 },
    { type: 'multiple_choice', content: 'The policy was a(n) _____ for disaster.', options: ['recipe', 'formula', 'prescription', 'all of the above'], correctAnswer: 'all of the above', points: 5 },
    { type: 'multiple_choice', content: 'He offered a(n) _____ apology that satisfied no one.', options: ['perfunctory', 'perpetual', 'pernicious', 'perspicacious'], correctAnswer: 'perfunctory', points: 5 },
    { type: 'true_false', content: '"I wouldn\'t put it past him" means he is probably capable of doing it.', options: ['True', 'False'], correctAnswer: 'True', points: 5 },
    { type: 'multiple_choice', content: 'The phenomenon defies any _____ explanation.', options: ['prosaic', 'poetic', 'prolix', 'prophetic'], correctAnswer: 'prosaic', points: 5 },
    { type: 'multiple_choice', content: 'So _____ was the task that experts were baffled.', options: ['abstruse', 'obtuse', 'abusive', 'absurd'], correctAnswer: 'abstruse', points: 5 },
    { type: 'multiple_choice', content: 'Her analysis was both _____ and insightful.', options: ['incisive', 'indecisive', 'insipid', 'intemperate'], correctAnswer: 'incisive', points: 5 },
    { type: 'short_answer', content: 'Complete: "But for your help, I _____ (not succeed)."', correctAnswer: 'would not have succeeded', points: 5 },
  ],
};

async function seed() {
  console.log('🔧 Seeding final quizzes and course requirements...\n');
  const db = require('./index');
  await db.connectDB();
  const { Quiz, Question, Course, User } = db.models;

  // 1. Update is_required: 4 courses per CEFR level = required, rest = optional
  console.log('1. Updating course is_required status (4 per level)...');
  const allCourses = await Course.findAll({
    where: { deletedAt: null },
    order: [['id', 'ASC']],
    attributes: ['id', 'title', 'level'],
  });

  if (allCourses.length === 0) {
    console.log('   ⚠️ No courses found. Skipping course update.');
  } else {
    const LEVEL_MAP = {
      'BEGINNER': 'A1',
      'ELEMENTARY': 'A2',
      'INTERMEDIATE': 'B1',
      'UPPER-INTERMEDIATE': 'B2',
      'ADVANCED': 'C1',
      'PROFICIENCY': 'C2',
    };
    const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const requiredCount = {};
    let totalRequired = 0;

    for (const c of allCourses) {
      const rawLevel = (c.level || '').toString().trim().toUpperCase();
      const mappedLevel = LEVEL_MAP[rawLevel] || rawLevel;
      const isCefr = CEFR_LEVELS.includes(mappedLevel);
      const levelKey = isCefr ? mappedLevel : '_OTHER';

      if (!requiredCount[levelKey]) requiredCount[levelKey] = 0;

      const shouldRequire = isCefr && requiredCount[levelKey] < 4;
      if (shouldRequire) {
        await c.update({ isRequired: true });
        requiredCount[levelKey]++;
        totalRequired++;
        console.log(`   ✅ [${mappedLevel}] #${c.id} - ${c.title}`);
      } else {
        await c.update({ isRequired: false });
        console.log(`   ○ [${mappedLevel}] #${c.id} - ${c.title}`);
      }
    }

    console.log(`\n   📊 Total required courses: ${totalRequired}`);
    for (const lvl of CEFR_LEVELS) {
      console.log(`      ${lvl}: ${requiredCount[lvl] || 0} required`);
    }
  }

  // 2. Find or create admin user
  console.log('\n2. Finding admin user...');
  let adminUser = await User.findOne({ where: { role: 'admin' }, order: [['id', 'ASC']] });
  if (!adminUser) {
    adminUser = await User.findOne({ order: [['id', 'ASC']] });
  }
  if (!adminUser) {
    console.log('   ❌ No users found. Cannot create quizzes.');
    process.exit(1);
  }
  console.log(`   Found user #${adminUser.id} (${adminUser.role})`);

  // 3. Create final quizzes and questions
  console.log('\n3. Creating final quizzes with 20 questions each...');
  for (const quizDef of QUIZZES) {
    const existing = await Quiz.findOne({
      where: { level: quizDef.level, isLevelFinal: true },
    });

    if (existing) {
      console.log(`   ⚠️  Quiz for ${quizDef.level} already exists (#${existing.id}). Skipping.`);
      continue;
    }

    const quiz = await Quiz.create({
      title: quizDef.title,
      description: quizDef.description,
      level: quizDef.level,
      isLevelFinal: true,
      courseId: null,
      maxScore: quizDef.maxScore,
      timeLimit: quizDef.timeLimit,
      passingScore: quizDef.passingScore,
      showResults: true,
      status: 'published',
      createdBy: adminUser.id,
      startTime: null,
      endTime: null,
      maxAttempts: 3,
    });
    console.log(`   ✅ Created ${quizDef.level} quiz (#${quiz.id})`);

    const questions = QUESTIONS[quizDef.level];
    for (const q of questions) {
      await Question.create({
        quizId: quiz.id,
        type: q.type,
        content: q.content,
        options: q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer,
        points: q.points,
        explanation: null,
        orderIndex: questions.indexOf(q),
      });
    }
    console.log(`      + ${questions.length} questions added`);
  }

  console.log('\n✅ Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
