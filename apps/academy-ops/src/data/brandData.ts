export const INITIAL_BRAND_DATA = {
  name: "Pathway Academy",
  slogan: "始于足下，通往世界 (Pathway to the World)",
  description: "一家专注于英文原版阅读、线下家庭英语独立工作室。致力于培养具备全球胜任力（Global Competence）的未来公民。",
  targetAudience: [
    "认同长期主义教育理念的家庭",
    "拥有全球视野，计划未来送孩子出国留学的家长",
    "支持家庭阅读氛围的父母",
    "重视孩子思辨能力（Critical Thinking）培养的家庭"
  ],
  coreValues: [
    "Global Citizenship (全球公民意识)",
    "Critical Thinking (深度思辨能力)",
    "Creative Communication (创新沟通方式)"
  ],
  curriculum: {
    partner: "National Geographic Learning (美国国家地理学习) & TED Talks",
    stages: [
      {
        name: "Trailblazer (开拓者)",
        age: "3-12岁",
        focus: "启蒙与探索，培养五大核心素养（视觉、文本、学科、创意、思辨）",
        level: "Pre-A1 to B1+"
      },
      {
        name: "Reflect (思考者)",
        age: "10-15岁",
        focus: "建立自信的学术沟通力，关联个人与世界",
        level: "A1 to C1"
      },
      {
        name: "Pathways (集大成者)",
        age: "15岁+",
        focus: "通往顶尖学术殿堂，学术派，思辨能力，大学预备",
        level: "A2 to C1"
      }
    ],
    specialCourses: [
      "Pioneer 哲学思辨课 (由母语为英语的外籍哲学教授亲授)",
      "Nature Compass STEAM (周末户外探索活动)"
    ]
  },
  usps: [
    "家庭原版英语工作室 (Family-style Original English Workshop)",
    "100%持有国际认可TEFL/TESOL证书的师资团队",
    "Spark智能学习平台 (数字化教学)",
    "沉浸式原版书海 (逾千册进口原版童书)"
  ],
  tone: "专业、温暖、具有国际视野、强调长期主义与成长",
  logoUrl: ""
};

export type BrandData = typeof INITIAL_BRAND_DATA;
