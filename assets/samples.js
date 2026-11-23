/* ============================================================
   samples.js —— 内置示例课件（无需 API Key）
   用于「先看看成品」：打开即渲染逐页 + 自动配图，可直接导出。
   ============================================================ */
(function (global) {
  'use strict';

  var WALKER = {
    id: 'walker',
    label: '高中地理 · 沃克环流与厄尔尼诺',
    theme: { styleId: 'editorial', paletteId: 'ocean', fontId: 'sans-cn', animId: 'fade-up' },
    deck: {
      title: '沃克环流与厄尔尼诺',
      subtitle: '赤道太平洋上的“海气对话”',
      meta: { grade: '高中地理 · 选择性必修一', subject: '地理', minutes: 45 },
      slides: [
        {
          type: 'cover', title: '沃克环流与厄尔尼诺',
          subtitle: '赤道太平洋上的“海气对话”',
          notes: '从“同一纬度，为什么东西两岸天气完全不同”这个问题开场。'
        },
        {
          type: 'section', title: '一、赤道太平洋的“跷跷板”', subtitle: '先看正常年份：西边下雨，东边干旱',
          notes: '提醒学生：赤道地区终年高温，但降水并不均匀。'
        },
        {
          type: 'bullets', title: '正常年份：西暖东冷',
          bullets: [
            '信风自东向西吹；把表层暖水不断推向西太平洋',
            '西太平洋暖池：海温高、空气受热上升，多对流雨',
            '东太平洋：冷水上涌、空气下沉，沿岸干旱少雨',
            '一升一沉，构成一个闭合的纬向环流圈'
          ],
          homework: '想一想：如果没有信风，赤道太平洋会变成什么样？',
          notes: '先让学生看地图找印尼和南美，再描述“西暖东冷”的格局。'
        },
        {
          type: 'image', title: '沃克环流：一台看不见的“热机”',
          subtitle: '建议配图：正常年份赤道太平洋沃克环流示意图（箭头表示气流方向）',
          bullets: [
            '西侧：暖水聚集 → 上升气流 → 成云致雨',
            '高空：气流自西向东输送',
            '东侧：气流下沉 → 晴朗干燥'
          ],
          image: {
            caption: '正常年份：信风把暖水堆到西侧，西侧上升、东侧下沉',
            layout: 'right'
          },
          notes: '沿箭头走一遍：海面 → 上升 → 高空东流 → 下沉 → 海面返回。'
        },
        {
          type: 'list', title: '沃克环流的四个环节',
          bullets: [
            '信风堆积暖水；赤道表层水自东向西流动',
            '西侧暖池加热空气；空气受热膨胀上升',
            '高空形成向东的气压梯度；气流由西向东',
            '东侧空气下沉；近地面再向西补充，形成闭环'
          ],
          notes: '强调“热力环流”的一般原理，再迁移到赤道太平洋。'
        },
        {
          type: 'section', title: '二、当信风“松手”', subtitle: '厄尔尼诺：暖水东移，环流重组',
          notes: '用“跷跷板失去平衡”作比喻。'
        },
        {
          type: 'bullets', title: '厄尔尼诺：一场“东移”的暖事件',
          bullets: [
            '信风减弱甚至反向；西太平洋暖水向东回流',
            '暖池东移；对流中心随之移到中东太平洋',
            '西太平洋（印尼、澳大利亚）降水减少，易干旱',
            '中东太平洋（秘鲁沿岸）降水增多，易洪涝'
          ],
          homework: '为什么秘鲁沿岸平时干旱，厄尔尼诺年反而多雨？',
          notes: '把“海温—气流—降水”三者的因果链写在黑板上。'
        },
        {
          type: 'image', title: '厄尔尼诺年：对流东移、天气反转',
          subtitle: '建议配图：厄尔尼诺年赤道太平洋环流示意图（箭头表示气流方向）',
          bullets: [
            '上升支东移：对流中心从西太平洋移到中太平洋',
            '下沉支分裂：印尼与南美两侧都以下沉为主',
            '我国：夏季风偏弱，易出现南涝北旱'
          ],
          image: {
            caption: '厄尔尼诺年（下）与正常年份（上）的环流对比',
            layout: 'right'
          },
          notes: '对比上下两幅图的上升支位置，这是最关键的变化。'
        },
        {
          type: 'two-col', title: '正常年份 vs 厄尔尼诺年',
          columns: [
            { title: '正常年份', items: ['信风强，暖水西堆', '上升支在西太平洋', '印尼多雨、秘鲁干旱', '沃克环流完整'] },
            { title: '厄尔尼诺年', items: ['信风弱，暖水东移', '上升支在中东太平洋', '印尼干旱、秘鲁多雨', '沃克环流减弱/东移'] }
          ],
          notes: '让学生用“因为……所以……”各说一句。'
        },
        {
          type: 'stats', title: '三个数字记住厄尔尼诺',
          subtitle: '判定标准与发生规律',
          stats: [
            { value: '+0.5°C', label: '尼诺 3.4 区海温距平阈值', note: '连续 5 个重叠的 3 个月滑动平均' },
            { value: '2–7 年', label: '平均发生周期', note: '并不严格周期，像“不守时的客人”' },
            { value: '9–12 个月', label: '典型持续时间', note: '往往在冬春季达到峰值' }
          ],
          notes: '说明这是业务判定标准，不是只看某一天的海温。'
        },
        {
          type: 'image', title: '影响不止在海上：干旱与洪涝',
          subtitle: '建议配图：厄尔尼诺的远程影响（印尼干旱、秘鲁洪涝、我国夏季风异常）',
          bullets: [
            '印尼、澳大利亚：干旱、森林火灾风险升高',
            '秘鲁、厄瓜多尔：暴雨、洪涝、泥石流',
            '我国：夏季风减弱，降水“南多北少”概率增大'
          ],
          image: {
            caption: '厄尔尼诺的远程影响：一暖一冷，牵动全球天气',
            layout: 'left'
          },
          notes: '用“ teleconnection（遥相关）”点一下，不展开公式。'
        },
        {
          type: 'list', title: '我国的连锁反应',
          bullets: [
            '夏季：西太平洋副高偏南偏强，南方多雨',
            '夏季：北方水汽输送减弱，易高温少雨',
            '冬季：东亚冬季风偏弱，常出现暖冬',
            '台风：生成源地偏东，登陆个数可能偏少'
          ],
          notes: '提醒学生：这是概率性影响，不是每年都完全一样。'
        },
        {
          type: 'quote', quote: '海洋记得每一次风的犹豫。', author: '— 写在最后：气候是海与气共同写下的长信',
          notes: '收束情感，回到“海气相互作用”的主题。'
        },
        {
          type: 'end', title: '谢谢观看', subtitle: '下一站：拉尼娜，跷跷板的另一头',
          bullets: ['课后思考：拉尼娜年，沃克环流会怎样变化？'],
          notes: '布置一个迁移任务：画一张拉尼娜年的环流示意图。'
        }
      ]
    }
  };

  var ENGLISH = {
    id: 'english',
    label: '小学三年级英语 · 第一课 Hello!',
    theme: { styleId: 'playful', paletteId: 'candy', fontId: 'sans-cn', animId: 'fade-up' },
    deck: {
      title: '小学三年级英语 · 第一课',
      subtitle: 'Hello! 从字母到问候',
      meta: { grade: '小学三年级', subject: '英语', minutes: 40 },
      slides: [
        {
          type: 'cover', title: 'Hello! 第一课',
          subtitle: '字母 A–G · 三句问候 · 一次自我介绍',
          notes: '用一首 Hello song 开场，让学生先听、再跟。'
        },
        {
          type: 'section', title: 'Unit 1  Hello!', subtitle: '今天我们要学会：看见字母能读，见面能打招呼',
          notes: '告诉学生今天的三个小目标。'
        },
        {
          type: 'image', title: '字母 A–G：看见就能读',
          subtitle: '建议配图：A–G 字母卡与代表单词（Apple, Ball, Cat…）',
          bullets: [
            '每个字母有两个身份：大写 A / 小写 a',
            '记住字母名，也记住它开头的单词',
            '跟老师拍手读：A–A–Apple'
          ],
          image: {
            caption: 'A–G 字母卡：字母名 + 开头单词 + 图像记忆',
            layout: 'right'
          },
          notes: '用拍手节奏读字母，一次只教 3 个，避免过载。'
        },
        {
          type: 'image', title: '见面怎么打招呼？',
          subtitle: '建议配图：课堂对话场景（Hello! / Hi! / Good morning!）',
          bullets: [
            'Hello! 和 Hi! 一天中任何时候都能用',
            'Good morning! 用在中午 12 点之前',
            '回答也可以只说 Hello! / Hi!'
          ],
          image: {
            caption: '课堂对话：Hello! — Hi! — Good morning!',
            layout: 'left'
          },
          notes: '教师先示范，再请同桌两两练习，最后上台展示。'
        },
        {
          type: 'bullets', title: '三句最常用的问候',
          bullets: [
            'Hello! —— 最通用，正式、非正式都可以',
            'Hi! —— 更随意，适合朋友和同学',
            'Good morning! —— 早上见面用，中午前有效',
            'Nice to meet you! —— 第一次见面说'
          ],
          notes: '把四句写在黑板上，标出使用场景。'
        },
        {
          type: 'two-col', title: '早上 vs 下午',
          columns: [
            { title: '早上（12 点前）', items: ['Good morning!', 'Hello!', 'Hi!'] },
            { title: '下午 / 晚上', items: ['Good afternoon!', 'Good evening!', 'Hi!'] }
          ],
          notes: '用钟表图辅助，让学生判断该用哪一句。'
        },
        {
          type: 'list', title: '课堂活动：开火车问候',
          bullets: [
            '全班围成一圈；教师先向第一位同学问好',
            '第一位同学回答，再转向下一位同学问好',
            '说错或停顿超过 3 秒，表演一个字母动作',
            '最后全班一起说：Nice to meet you!'
          ],
          notes: '控制节奏，保证每个学生至少开口一次。'
        },
        {
          type: 'stats', title: '今天要记住的数字',
          subtitle: '把目标变小，才记得住',
          stats: [
            { value: '26', label: '英语字母总数', note: '今天先学 7 个：A–G' },
            { value: '7', label: '本课字母', note: '大写 + 小写都要认' },
            { value: '3', label: '核心问候句', note: 'Hello / Hi / Good morning' }
          ],
          notes: '用数字帮助学生建立“今天学了多少”的成就感。'
        },
        {
          type: 'image', title: '自我介绍：三步就够',
          subtitle: '建议配图：自我介绍三步流程图（名字 → 问候 → 告别）',
          bullets: [
            'Hello! 先打招呼',
            'My name is Amy. 说出名字',
            'Goodbye! 礼貌结束'
          ],
          image: {
            caption: '自我介绍三步：Greet → Name → Goodbye',
            layout: 'right'
          },
          notes: '给学生 30 秒准备，用玩偶做示范。'
        },
        {
          type: 'bullets', title: '易错提醒',
          bullets: [
            'Good morning 不是全天通用；下午要用 Good afternoon',
            'Hello 的 h 要送气，别读成“哈喽”',
            'My name is… 后面直接说名字，不加 I am',
            '第一次见面用 Nice to meet you，不是 Nice to meet you again'
          ],
          notes: '用“错误示范 + 正确示范”对比，让学生找不同。'
        },
        {
          type: 'quote', quote: 'Hello 是一扇门，推开它，世界就开始回应你。', author: '— 给第一次开口说英语的你',
          notes: '鼓励害怕开口的学生：说错也没关系。'
        },
        {
          type: 'end', title: 'Goodbye!', subtitle: '今天回家，向家人说一句 Hello!',
          bullets: ['作业：录一段 15 秒自我介绍', '下节课：字母 H–N'],
          notes: '布置录音作业，降低开口门槛。'
        }
      ]
    }
  };

  var REFRACTION = {
    id: 'refraction',
    label: '初中物理 · 光的折射',
    theme: { styleId: 'tech', paletteId: 'ice', fontId: 'sans-cn', animId: 'fade-up' },
    deck: {
      title: '光的折射',
      subtitle: '从筷子“折断”到透镜成像',
      meta: { grade: '初中物理 · 八年级', subject: '物理', minutes: 45 },
      slides: [
        {
          type: 'cover', title: '光的折射',
          subtitle: '为什么水里的筷子看起来“折断”了？',
          notes: '先做演示实验：把筷子斜插入水中，让学生观察。'
        },
        {
          type: 'section', title: '一、光从空气进入水中', subtitle: '传播方向为什么会改变？',
          notes: '引导学生提出假设：光在不同介质中传播速度不同。'
        },
        {
          type: 'bullets', title: '生活中的折射现象',
          bullets: [
            '筷子斜插入水中，看起来向上“折断”',
            '池水看起来比实际浅，不能贸然下水',
            '早晨太阳还在地平线下，我们就看见了它',
            '放大镜、近视镜、照相机镜头都利用折射'
          ],
          homework: '再找两个生活中的折射现象，下节课分享。',
          notes: '每个现象让学生先猜“光路怎么走”，再看图。'
        },
        {
          type: 'image', title: '光从空气斜射入水中',
          subtitle: '建议配图：入射光线、法线、折射光线与角度示意图',
          bullets: [
            '入射光线、折射光线分居法线两侧',
            '折射角小于入射角：光线靠近法线偏折',
            '垂直入射时，传播方向不改变'
          ],
          image: {
            caption: '空气 → 水：折射角 r 小于入射角 i',
            layout: 'right'
          },
          notes: '板演光路图，标出法线、入射角、折射角，强调“角从法线量起”。'
        },
        {
          type: 'list', title: '实验：观察折射光路',
          bullets: [
            '激光笔紧贴水槽壁，斜射入水中；注意不要直射眼睛',
            '在水中滴几滴牛奶，让光路更清晰',
            '改变入射角，记录折射角的变化',
            '把水换成玻璃砖，比较偏折程度'
          ],
          notes: '强调激光安全：不可直视激光，不可照向同学。'
        },
        {
          type: 'two-col', title: '空气 vs 水：谁让光偏得更多？',
          columns: [
            { title: '空气 → 水', items: ['折射角 < 入射角', '光线靠近法线', 'n 水 ≈ 1.33'] },
            { title: '水 → 空气', items: ['折射角 > 入射角', '光线远离法线', '可能发生全反射'] }
          ],
          notes: '用“光密/光疏”解释偏折方向，不要求定量计算。'
        },
        {
          type: 'stats', title: '记住这几个数',
          stats: [
            { value: '1.00', label: '空气的折射率', note: '近似等于真空' },
            { value: '1.33', label: '水的折射率', note: '20°C 左右' },
            { value: '1.5', label: '玻璃的折射率', note: '不同玻璃略有差异' }
          ],
          notes: '只要求记住水 1.33；其余可查表。'
        },
        {
          type: 'image', title: '折射让水看起来更浅',
          subtitle: '建议配图：池底光线折射后进入眼睛，像的位置上移',
          bullets: [
            '池底反射的光在水面折射后进入眼睛',
            '眼睛沿折射光线的反向延长线看，像的位置比实际浅',
            '所以“看见的池底”不等于“真实的池底”'
          ],
          image: {
            caption: '池底变浅：像的位置上移，实际水深比看起来深',
            layout: 'left'
          },
          notes: '用“叉鱼要瞄准鱼的下方”作迁移，但注意安全。'
        },
        {
          type: 'quote', quote: '光走最短时间的那条路，却让我们看见了一个被“折”过的世界。', author: '— 费马原理的一点点浪漫',
          notes: '学有余力可提一句费马原理，不作要求。'
        },
        {
          type: 'end', title: '谢谢观看', subtitle: '作业：画出光从水射入空气的光路图',
          bullets: ['标出法线、入射角、折射角', '注明光线偏折方向'],
          notes: '提醒学生：角一定从法线量起。'
        }
      ]
    }
  };

  global.SAMPLES = [WALKER, ENGLISH, REFRACTION];
  global.SAMPLE_BY_ID = { walker: WALKER, english: ENGLISH, refraction: REFRACTION };
})(typeof window !== 'undefined' ? window : this);
