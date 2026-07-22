export const fallbackSite = {
  brand: {
    mark: "K",
    subtitle: "陈栖 / personal OS",
    title: "Knowledge Log",
  },
  filters: ["全部", "AI", "前端", "产品", "生活"],
  filterTags: ["全部"],
  hero: {
    description: "把文章、项目、技术笔记和生活随笔放在同一个可检索、可持续更新的界面里。",
    eyebrow: "KNOWLEDGE LOG / 持续写作",
    title: "个人知识工作台",
  },
  navItems: ["总览", "文章库", "技术笔记", "作品集", "生活随笔", "归档"],
  stats: [
    { label: "已发布文章", value: "0" },
    { label: "作品项目", value: "0" },
  ],
  subscription: {
    description: "留下邮箱，加入博客更新名单。",
    enabled: true,
    title: "订阅更新",
  },
  writingState: "持续记录技术、产品、阅读与生活中的可复用经验。",
};

export const emptyPostForm = {
  body: "",
  category: "文章库",
  excerpt: "",
  featured: false,
  kind: "ARTICLE",
  readTime: "5 min",
  slug: "",
  status: "draft",
  tags: "写作, 前端",
  title: "",
  version: 1,
};
