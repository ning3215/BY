# 慢慢喜欢你

一个关于情侣纪念、回忆、约定、情书和私密聊天的小网站。

## 本地预览

直接在浏览器打开 `index.html` 即可预览。也可以用任意静态服务器托管整个目录。

## 开启聊天

聊天功能使用 Supabase 登录、数据库和实时订阅。前端可以继续部署在 GitHub Pages，但需要先配置 Supabase。

1. 在 Supabase 新建项目。
2. 打开 SQL Editor，复制并运行 `supabase/schema.sql`。
3. 把 SQL 文件底部的两个邮箱、昵称和 `couple_id` 换成你和对象的信息。
4. 在 Supabase 的 Project Settings 里复制 Project URL 和 anon/publishable key。
5. 修改 `config.js`：

```js
window.LOVE_SITE_CONFIG = {
  supabaseUrl: "你的 Project URL",
  supabaseAnonKey: "你的 anon 或 publishable key",
  coupleId: "和 SQL 里一致的 UUID"
};
```

不要把 service_role key 放到前端。前端只使用 anon/publishable key，真正的私密权限由 Supabase RLS 控制。

## 自定义

- 修改 `index.html` 里的日期、回忆、约定和情书内容。
- 替换 `assets/hero.png` 可以更换首页主视觉。
- 修改 `styles.css` 可以调整配色和排版。
