import { FloppyDisk, Globe } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { fetchAdminSettings, updateAdminSettings } from "../../api.js";
import { StatusBanner } from "../../shared/components/Feedback.jsx";

function listFromInput(value) {
  return [...new Set(String(value).split(",").map((item) => item.trim()).filter(Boolean))];
}

export function AdminSettings() {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [navInput, setNavInput] = useState("");
  const [filterInput, setFilterInput] = useState("");

  useEffect(() => {
    fetchAdminSettings()
      .then((payload) => {
        setSettings(payload.settings);
        setNavInput(payload.settings.navItems.join(", "));
        setFilterInput(payload.settings.filters.join(", "));
        setStatus("ready");
      })
      .catch((error) => {
        setErrorMessage(error.message);
        setStatus("error");
      });
  }, []);

  function updateSection(section, field, value) {
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], [field]: value },
    }));
  }

  async function save(event) {
    event.preventDefault();
    setStatus("saving");
    setErrorMessage("");
    setNoticeMessage("");
    try {
      const payload = await updateAdminSettings({
        ...settings,
        filters: listFromInput(filterInput),
        navItems: listFromInput(navInput),
      });
      setSettings(payload.settings);
      setNavInput(payload.settings.navItems.join(", "));
      setFilterInput(payload.settings.filters.join(", "));
      setNoticeMessage("站点设置已更新，公开首页会立即使用新内容。");
      setStatus("ready");
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    }
  }

  return (
    <section className="admin-panel settings-panel">
      <div className="admin-hero"><div><h1>站点设置</h1><p>维护公开博客的品牌、首页文案、导航和订阅入口。</p></div><span className="section-icon"><Globe size={22} /></span></div>
      <StatusBanner message={noticeMessage} title="保存成功" tone="success" />
      <StatusBanner message={status === "error" ? errorMessage : ""} title="设置保存失败" />
      {status === "loading" || !settings ? <div className="empty-state"><strong>正在读取站点设置</strong><p>同步公开页面配置。</p></div> : (
        <form className="settings-form" onSubmit={save}>
          <section className="settings-section"><div className="section-heading"><span>品牌信息</span><small>导航与页面标题</small></div><div className="settings-grid">
            <label className="field"><span>站点名称</span><input onChange={(event) => updateSection("brand", "title", event.target.value)} required value={settings.brand.title} /></label>
            <label className="field"><span>品牌标记</span><input maxLength={3} onChange={(event) => updateSection("brand", "mark", event.target.value)} required value={settings.brand.mark} /></label>
            <label className="field wide-field"><span>副标题</span><input onChange={(event) => updateSection("brand", "subtitle", event.target.value)} value={settings.brand.subtitle} /></label>
          </div></section>

          <section className="settings-section"><div className="section-heading"><span>首页内容</span><small>首屏公开文案</small></div><div className="settings-grid">
            <label className="field wide-field"><span>眉题</span><input onChange={(event) => updateSection("hero", "eyebrow", event.target.value)} value={settings.hero.eyebrow} /></label>
            <label className="field wide-field"><span>首页标题</span><input onChange={(event) => updateSection("hero", "title", event.target.value)} required value={settings.hero.title} /></label>
            <label className="field wide-field"><span>首页简介</span><textarea onChange={(event) => updateSection("hero", "description", event.target.value)} rows={3} value={settings.hero.description} /></label>
            <label className="field wide-field"><span>写作状态</span><textarea onChange={(event) => setSettings((current) => ({ ...current, publicWritingState: event.target.value }))} rows={3} value={settings.publicWritingState} /></label>
          </div></section>

          <section className="settings-section"><div className="section-heading"><span>导航与筛选</span><small>使用英文逗号分隔</small></div><div className="settings-grid">
            <label className="field wide-field"><span>导航项目</span><input onChange={(event) => setNavInput(event.target.value)} value={navInput} /><small className="field-help">必须保留“总览”，分类名称应与文章分类一致。</small></label>
            <label className="field wide-field"><span>快捷筛选</span><input onChange={(event) => setFilterInput(event.target.value)} value={filterInput} /></label>
          </div></section>

          <section className="settings-section"><div className="section-heading"><span>订阅入口</span><small>公开邮箱名单</small></div><div className="settings-grid">
            <label className="field wide-field"><span>入口标题</span><input onChange={(event) => updateSection("subscription", "title", event.target.value)} value={settings.subscription.title} /></label>
            <label className="field wide-field"><span>说明</span><textarea onChange={(event) => updateSection("subscription", "description", event.target.value)} rows={3} value={settings.subscription.description} /></label>
            <label className="toggle-field"><input checked={settings.subscription.enabled} onChange={(event) => updateSection("subscription", "enabled", event.target.checked)} type="checkbox" /><span>在公开首页显示订阅入口</span></label>
          </div></section>

          <div className="form-actions sticky-form-actions"><button className="primary-action" disabled={status === "saving"} type="submit"><FloppyDisk size={18} />{status === "saving" ? "保存中" : "保存设置"}</button></div>
        </form>
      )}
    </section>
  );
}
