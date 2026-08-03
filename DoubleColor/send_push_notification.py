# -*- coding: utf-8 -*-
"""
双色球 AI 预测 — 项目推送通知脚本
当代码推送到 GitHub 时，发送通知邮件告知最新状态
"""

import json
import os
import sys
import smtplib
import subprocess
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Any, Dict, List, Optional

# 强制 UTF-8 输出
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())


# ==================== 配置（优先从环境变量读取）====================

SMTP_HOST = os.environ.get("EMAIL_HOST", "smtp.qq.com")
SMTP_PORT = int(os.environ.get("EMAIL_PORT", "465"))
SMTP_USE_SSL = os.environ.get("EMAIL_USE_SSL", "1") == "1"
SMTP_USERNAME = os.environ.get("EMAIL_USERNAME", "")
SMTP_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
SENDER_NAME = os.environ.get("SENDER_NAME", "双色球 AI 预测系统")
RECIPIENTS = os.environ.get("EMAIL_RECIPIENTS", "your_email@qq.com")
RECIPIENTS = [r.strip() for r in RECIPIENTS.split(";") if r.strip()]
DRY_RUN = os.environ.get("EMAIL_DRY_RUN", "1") == "1"

# 数据文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOTTERY_HISTORY_FILE = os.path.join(SCRIPT_DIR, "data", "lottery_history.json")
AI_PREDICTIONS_FILE = os.path.join(SCRIPT_DIR, "data", "ai_predictions.json")


def check_config() -> None:
    """检查配置完整性"""
    if not SMTP_USERNAME:
        print("❌ 请设置 EMAIL_USERNAME 环境变量")
        sys.exit(1)
    if not SMTP_PASSWORD:
        print("❌ 请设置 EMAIL_PASSWORD 环境变量")
        sys.exit(1)
    if not RECIPIENTS or RECIPIENTS == ["your_email@qq.com"]:
        print("❌ 请设置 EMAIL_RECIPIENTS 环境变量")
        sys.exit(1)
    print(f"📧 收件人: {', '.join(RECIPIENTS)}")
    print(f"📤 发件人: {SENDER_NAME} <{SMTP_USERNAME}>")


def load_json(filepath: str) -> Dict[str, Any]:
    """加载 JSON 数据"""
    if not os.path.exists(filepath):
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def get_git_info() -> Dict[str, str]:
    """获取 Git 提交信息"""
    info = {
        "commit_sha": os.environ.get("GITHUB_SHA", ""),
        "commit_message": os.environ.get("GITHUB_COMMIT_MESSAGE", ""),
        "commit_author": os.environ.get("GITHUB_ACTOR", "unknown"),
        "ref": os.environ.get("GITHUB_REF", ""),
        "repository": os.environ.get("GITHUB_REPOSITORY", ""),
        "run_url": os.environ.get("GITHUB_RUN_ID", ""),
        "workflow": os.environ.get("GITHUB_WORKFLOW", ""),
    }

    # 如果在 GitHub Actions 中，构建提交详情链接
    if info["repository"] and info["commit_sha"]:
        info["commit_url"] = f"https://github.com/{info['repository']}/commit/{info['commit_sha'][:7]}"
    else:
        info["commit_url"] = ""

    # 尝试从 git 获取提交信息（本地环境）
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%s"],
            capture_output=True, text=True, cwd=SCRIPT_DIR
        )
        if result.returncode == 0:
            info["commit_message"] = result.stdout.strip()
    except Exception:
        pass

    return info


def format_ball(num: str, color: str) -> str:
    """返回格式化号码球（带颜色样式）"""
    bg = "#dc2626" if color == "red" else "#2563eb"
    return f'<span style="display:inline-block;background:{bg};color:#fff;' \
           f'border-radius:50%;width:28px;height:28px;line-height:28px;' \
           f'text-align:center;font-weight:600;font-size:13px;margin:0 2px;">{num}</span>'


def build_email_content(git_info: Dict[str, str],
                         lottery_data: Dict[str, Any],
                         predictions_data: Dict[str, Any]) -> str:
    """构建 HTML 邮件正文"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    next_draw = lottery_data.get("next_draw", {})

    html_parts = []

    # 页眉
    html_parts.append(f"""
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);color:#fff;
                    padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <div style="font-size:36px;margin-bottom:6px;">🔄</div>
            <h1 style="margin:0;font-size:20px;">项目更新通知</h1>
            <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">{SENDER_NAME} · {now}</p>
        </div>
    """)

    # Git 提交信息
    msg = git_info.get("commit_message", "数据更新")
    author = git_info.get("commit_author", "unknown")
    repo = git_info.get("repository", "")
    commit_url = git_info.get("commit_url", "")
    workflow = git_info.get("workflow", "手动更新")

    commit_link = ""
    if commit_url:
        commit_link = f'<a href="{commit_url}" style="color:#2563eb;">查看提交</a>'

    html_parts.append(f"""
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:16px 20px;
                    font-size:14px;line-height:1.8;">
            <div style="font-weight:600;color:#166534;margin-bottom:8px;">📦 更新详情</div>
            <table style="width:100%;font-size:13px;">
                <tr><td style="color:#6b7280;width:80px;">提交信息</td>
                    <td style="font-weight:600;">{msg}</td></tr>
                <tr><td style="color:#6b7280;">提交者</td>
                    <td>{author}</td></tr>
                <tr><td style="color:#6b7280;">仓库</td>
                    <td>{repo}</td></tr>
                <tr><td style="color:#6b7280;">触发方式</td>
                    <td>{workflow}</td></tr>
                <tr><td style="color:#6b7280;">链接</td>
                    <td>{commit_link}</td></tr>
            </table>
        </div>
    """)

    # 最新开奖信息
    latest = lottery_data.get("data", [])
    if latest:
        latest_draw = latest[0]
        period = latest_draw.get("period", "-")
        date = latest_draw.get("date", "-")
        reds = latest_draw.get("red_balls", [])
        blue = latest_draw.get("blue_ball", "-")

        red_html = " ".join(format_ball(r, "red") for r in reds)
        blue_html = format_ball(blue, "blue")

        html_parts.append(f"""
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;
                    margin:14px 0;overflow:hidden;">
            <div style="background:#dc2626;color:#fff;padding:12px 18px;
                        font-size:15px;font-weight:600;">
                🏆 最新开奖结果 · 第 {period} 期
            </div>
            <div style="padding:16px 18px;text-align:center;">
                <div style="color:#6b7280;font-size:13px;margin-bottom:8px;">
                    开奖日期：{date}
                </div>
                <div style="font-size:0;">
                    {red_html}
                    <span style="color:#6b7280;font-size:14px;margin:0 6px;">+</span>
                    {blue_html}
                </div>
            </div>
        </div>
        """)

    # 下期开奖信息
    nd_date = next_draw.get("next_date_display", "-")
    nd_period = next_draw.get("next_period", "-")
    nd_weekday = next_draw.get("weekday", "-")
    nd_time = next_draw.get("draw_time", "21:15")

    html_parts.append(f"""
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;
                    margin:14px 0;padding:16px 18px;">
            <div style="font-weight:600;font-size:15px;margin-bottom:10px;">
                🔮 下期开奖
            </div>
            <table style="width:100%;font-size:13px;">
                <tr><td style="color:#6b7280;width:100px;">期号</td>
                    <td style="font-weight:600;">第 {nd_period} 期</td></tr>
                <tr><td style="color:#6b7280;">日期</td>
                    <td>{nd_date}（{nd_weekday}）</td></tr>
                <tr><td style="color:#6b7280;">时间</td>
                    <td>{nd_time}</td></tr>
            </table>
        </div>
    """)

    # AI 预测概览
    target_period = predictions_data.get("target_period", "-")
    models = predictions_data.get("models", [])
    if models:
        html_parts.append(f"""
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;
                    margin:14px 0;overflow:hidden;">
            <div style="background:#2563eb;color:#fff;padding:12px 18px;
                        font-size:15px;font-weight:600;">
                🤖 AI 预测概览 · 第 {target_period} 期
            </div>
            <div style="padding:14px 18px;">
        """)

        for model in models:
            model_name = model.get("model_name", "-")
            preds = model.get("predictions", [])
            # 取第一组预测作为概览
            if preds:
                first = preds[0]
                reds = first.get("red_balls", [])
                blue = first.get("blue_ball", "-")
                strategy = first.get("strategy", "-")
                red_html = " ".join(format_ball(r, "red") for r in reds)
                blue_html = format_ball(blue, "blue")

                html_parts.append(f"""
                <div style="margin-bottom:10px;padding:10px;background:#f8fafc;
                            border-radius:6px;border-left:3px solid #2563eb;">
                    <div style="font-weight:600;font-size:13px;margin-bottom:4px;">
                        {model_name} · {strategy}
                    </div>
                    <div>{red_html}  +  {blue_html}</div>
                </div>
                """)

        html_parts.append("</div></div>")

    # 底部链接
    repo_url = f"https://github.com/{repo}" if repo else "#"
    html_parts.append(f"""
        <div style="text-align:center;padding:16px 0;font-size:12px;">
            <a href="{repo_url}" style="color:#2563eb;text-decoration:none;">
                📂 查看仓库
            </a>
            <span style="color:#d1d5db;margin:0 8px;">|</span>
            <a href="https://github.com/{repo}/actions" style="color:#2563eb;text-decoration:none;">
                ⚡ 查看运行记录
            </a>
        </div>
        <div style="text-align:center;color:#9ca3af;font-size:11px;padding:0 0 20px;">
            {SENDER_NAME} · 自动推送 · {now}
        </div>
    </div>
    """)

    return "\n".join(html_parts)


def send_email(subject: str, html_body: str, dry_run: bool = False) -> bool:
    """发送 HTML 邮件"""
    if dry_run:
        print("\n" + "=" * 50)
        print("📧 [DRY-RUN] 邮件内容预览")
        print("=" * 50)
        print(f"收件人: {', '.join(RECIPIENTS)}")
        print(f"主题: {subject}")
        print(f"HTML 长度: {len(html_body)} 字符")
        print("\n[HTML 内容] 前 2000 字符预览：")
        print(html_body[:2000])
        print("... (已截断)")
        print("=" * 50)
        print("✅ Dry-run 完成（未实际发送）")
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SENDER_NAME} <{SMTP_USERNAME}>"
    msg["To"] = ", ".join(RECIPIENTS)

    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if SMTP_USE_SSL:
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
            server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.sendmail(SMTP_USERNAME, RECIPIENTS, msg.as_string())
        server.quit()
        print(f"✅ 邮件发送成功！共发送至 {len(RECIPIENTS)} 个收件人")
        return True
    except smtplib.SMTPAuthenticationError:
        print("❌ 认证失败，请检查 SMTP 用户名和密码（邮箱授权码）")
        return False
    except smtplib.SMTPException as e:
        print(f"❌ SMTP 错误: {e}")
        return False
    except Exception as e:
        print(f"❌ 发送失败: {e}")
        return False


def main():
    print("=" * 50)
    print("  双色球 AI 预测 — 项目推送通知")
    print("=" * 50)

    # 检查配置
    check_config()

    # 获取 Git 信息
    print("\n📋 获取提交信息...")
    git_info = get_git_info()
    print(f"   提交: {git_info.get('commit_message', 'N/A')}")
    print(f"   作者: {git_info.get('commit_author', 'N/A')}")

    # 加载数据
    print("📂 加载数据...")
    lottery_data = load_json(LOTTERY_HISTORY_FILE)
    predictions_data = load_json(AI_PREDICTIONS_FILE)

    # 构建邮件
    print("📝 构建邮件内容...")
    msg = git_info.get("commit_message", "项目更新")
    subject = f"[双色球AI预测] 项目更新通知 · {msg[:40]}"
    html_body = build_email_content(git_info, lottery_data, predictions_data)

    # 发送
    print("\n📤 发送邮件...")
    success = send_email(subject, html_body, dry_run=DRY_RUN)

    if not success:
        sys.exit(1)
    print("\n✨ 完成")


if __name__ == "__main__":
    main()