# 慢慢喜欢你

一个关于情侣纪念、私密聊天、树洞便签、共享歌单、照片墙和真实世界城市地图的小网站。

## 本地预览

直接在浏览器打开 `index.html` 即可预览。也可以用任意静态服务器托管整个目录。

## 开启聊天

聊天、树洞便签、照片墙和城市地图使用 Supabase 登录、数据库、实时订阅和 Storage。前端可以继续部署在 GitHub Pages，但需要先配置 Supabase。

1. 在 Supabase 新建项目。
2. 打开 SQL Editor，复制并运行 `supabase/schema.sql`。
3. 在 Supabase 的 Project Settings 里复制 Project URL 和 anon/publishable key。
4. 修改 `config.js`：

```js
window.LOVE_SITE_CONFIG = {
  supabaseUrl: "你的 Project URL",
  supabaseAnonKey: "你的 anon 或 publishable key",
  coupleId: "093f97bb-50be-4bab-9c06-b32d508e2410",
  startDate: "2020-01-12",
  storageBucket: "couple-photos",
  music: {
    title: "我们的歌单",
    provider: "网易云 / QQ音乐",
    embedUrl: "你的网易云或 QQ 音乐 iframe 地址"
  }
};
```

不要把 service_role key 放到前端。前端只使用 anon/publishable key，真正的私密权限由 Supabase RLS 控制。

如果已经运行过旧版 SQL，也需要重新运行一次 `supabase/schema.sql`，这样照片墙和城市地图的删除权限才会生效。

默认允许登录邮箱：

- `1784078493@qq.com`
- `3212215136@qq.com`

## 功能

- 纪念日倒计时：恋爱开始日是 `2020-01-12`，自动计算恋爱天数和下一个周年纪念日。
- 留言板/树洞：登录后可以把便签贴到墙上。
- 共享歌单：在 `config.js` 填入网易云或 QQ 音乐的 iframe 嵌入地址。
- 照片墙：登录后可以上传图片到 Supabase Storage 私有桶，也可以删除已上传照片。
- 城市地图：使用 Leaflet + OpenStreetMap 真实地图，点击地图位置添加城市，之后可以手动点亮、熄灭或删除地点。

## 自定义

- 修改 `index.html` 里的标题、入口文案和页面结构。
- 替换 `assets/hero.png` 可以更换首页主视觉。
- 修改 `styles.css` 可以调整配色和排版。
