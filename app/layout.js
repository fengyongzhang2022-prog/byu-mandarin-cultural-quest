export const metadata = {
  title: "寻迹 · BYU中文文化任务",
  description: "六分钟生成式AI沉浸式跨文化角色扮演原型",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
