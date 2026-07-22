import { Eye, EyeSlash, House, LockKey } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { loginAdmin } from "../api.js";
import { useDocumentTitle } from "../app/hooks.js";
import { StatusBanner } from "../shared/components/Feedback.jsx";
import { ThemeButton } from "../shared/components/Navigation.jsx";

export function LoginPage({ isDark, navigate, next, setIsDark, setUser, user }) {
  useDocumentTitle("登录发布后台 | Knowledge Log");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (user) navigate(next || "/admin", { replace: true });
  }, [navigate, next, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    try {
      const payload = await loginAdmin({ username, password });
      setUser(payload.user);
      navigate(next || "/admin", { replace: true });
    } catch (error) {
      setErrorMessage(error.message);
      setStatus("error");
    }
  }

  return (
    <main className={isDark ? "app login-app app-dark" : "app login-app"}>
      <section className="login-panel">
        <button className="brand brand-button" onClick={() => navigate("/")} type="button">
          <span className="brand-mark">K</span><span><strong>Knowledge Log</strong><span>Admin Console</span></span>
        </button>
        <form className="login-form" onSubmit={handleSubmit}>
          <div><span className="post-kind">ADMIN LOGIN</span><h1>登录发布后台</h1><p>管理草稿、发布文章、站点设置和订阅名单。</p></div>
          <StatusBanner message={errorMessage} title="登录失败" />
          <div className="login-field"><label htmlFor="admin-username">账号</label><input autoComplete="username" id="admin-username" onChange={(event) => setUsername(event.target.value)} placeholder="admin" required value={username} /></div>
          <div className="login-field"><label htmlFor="admin-password">密码</label><div className="password-input">
            <input autoComplete="current-password" id="admin-password" onChange={(event) => setPassword(event.target.value)} placeholder="输入管理员密码" required type={isPasswordVisible ? "text" : "password"} value={password} />
            <button aria-label={isPasswordVisible ? "隐藏密码" : "显示密码"} onClick={() => setIsPasswordVisible((value) => !value)} type="button">{isPasswordVisible ? <EyeSlash size={19} /> : <Eye size={19} />}</button>
          </div></div>
          <div className="form-actions"><button className="primary-action" disabled={status === "loading"} type="submit"><LockKey size={18} />{status === "loading" ? "登录中" : "登录后台"}</button><button className="ghost-action" onClick={() => navigate("/")} type="button"><House size={18} />返回博客</button><ThemeButton isDark={isDark} setIsDark={setIsDark} /></div>
        </form>
      </section>
    </main>
  );
}
