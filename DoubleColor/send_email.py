# -*- coding: utf-8 -*-
"""
双色球 AI 预测 — 邮箱推送脚本
读取最新的 AI 预测数据并推送至指定邮箱
"""

import json
import os
import sys
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Any, Dict, List, Optional

# 强制 UTF-8 输出（Windows 兼容）
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import codecs
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())
    sys.stderr = codecs.getwriter("utf-8")(sys.stderr.detach())


# ==================== 配置区（优先从环境变量读取）====================

SMTP_HOST = os.environ.get("EMAIL_HOST", "smtp.qq.com")
SMTP_PORT = int(os.environ.get("EMAIL_PORT", "465"))
SMTP_USE_SSL = os.environ.get("EMAIL_USE_SSL", "1") == "1"
SMTP_USERNAME = os.environ.get("EMAIL_USERNAME", "")
SMTP_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
SENDER_NAME = os.environ.get("SENDER_NAME", "双色球 AI 预测系统")
RECIPIENTS = os.environ.get("EMAIL_RECIPIENTS", "your_email@qq.com")
RECIPIENTS = [r.strip() for r in RECIPIENTS.split(";") if r.strip()]
DRY_RUN = os.environ.get("EMAIL_DRY_RUN", "1") == "1"  # 默认 dry-run

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
        print("❌ 请设置 EMAIL_RECIPIENTS 环境变量（多个收件人用分号分隔）")
        sys.exit(1)
    print(f"📧 收件人: {', '.join(RECIPIENTS)}")
    print(f"📤 发件人: {SENDER_NAME} <{SMTP_USERNAME}>")


# ==================== 数据加载 ====================

def load_json(filepath: str) -> Dict[str, Any]:
    """加载 JSON 数据文件"""
    if not os.path.exists(filepath):
        print(f"❌ 文件不存在: {filepath}")
        sys.exit(1)
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def format_ball(num: str, color: str) -> str:
    """返回格式化后的号码球（带颜色样式）"""
    bg = "#dc2626" if color == "red" else "#2563eb"
    return f'<span style="display:inline-block;background:{bg};color:#fff;' \
           f'border-radius:50%;width:28px;height:28px;line-height:28px;' \
           f'text-align:center;font-weight:600;font-size:13px;margin:0 2px;">{num}</span>'


# ==================== 邮件内容构建 ====================

def build_email_content(predictions_data: Dict[str, Any],
                        lottery_data: Dict[str, Any]) -> str:
    """构建 HTML 邮件正文"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    next_draw = lottery_data.get("next_draw", {})
    pred_date = predictions_data.get("prediction_date", "-")
    target_period = predictions_data.get("target_period", "-")

    html_parts = []

    # 页眉
    html_parts.append(f"""
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">
        <div style="background:#1a1a2e;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h1 style="margin:0;font-size:22px;">🎟️ 双色球 AI 预测推送</h1>
            <p style="margin:6px 0 0;color:#aaa;font-size:13px;">{SENDER_NAME} · {now}</p>
        </div>
    """)

    # 开奖信息卡
    nd_date = next_draw.get("next_date_display", "-")
    nd_time = next_draw.get("draw_time", "21:15")
    html_parts.append(f"""
        <div style="background:#f8f9fa;border:1px solid #e5e7eb;border-top:none;
                    padding:16px 24px;font-size:14px;">
            <table style="width:100%;margin-bottom:6px;">
                <tr>
                    <td style="color:#6b7280;width:120px;">目标期号</td>
                    <td style="font-weight:600;">第 {target_period} 期</td>
                </tr>
                <tr>
                    <td style="color:#6b7280;">开奖日期</td>
                    <td style="font-weight:600;">{nd_date}</td>
                </tr>
                <tr>
                    <td style="color:#6b7280;">开奖时间</td>
                    <td style="font-weight:600;">{nd_time}</td>
                </tr>
                <tr>
                    <td style="color:#6b7280;">预测日期</td>
                    <td>{pred_date}</td>
                </tr>
            </table>
        </div>
    """)

    # 模型预测卡片
    models = predictions_data.get("models", [])
    for model in models:
        model_name = model.get("model_name", "-")
        model_id = model.get("model_id", "-")
        preds = model.get("predictions", [])

        html_parts.append(f"""
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;
                    margin:14px 0;overflow:hidden;">
            <div style="background:#dc2626;color:#fff;padding:12px 18px;
                        font-size:15px;font-weight:600;">
                🤖 {model_name}
            </div>
            <div style="padding:14px 18px;">
        """)

        for pred in preds:
            gid = pred.get("group_id", "?")
            strategy = pred.get("strategy", "-")
            reds = pred.get("red_balls", [])
            blue = pred.get("blue_ball", "-")
            desc = pred.get("description", "")

            red_balls_html = " ".join(format_ball(r, "red") for r in reds)
            blue_ball_html = format_ball(blue, "blue")

            html_parts.append(f"""
                <div style="margin-bottom:12px;padding:10px;
                            background:#f9fafb;border-radius:6px;
                            border-left:3px solid #dc2626;">
                    <div style="font-weight:600;font-size:13px;margin-bottom:4px;">
                        G-{gid} · {strategy}
                    </div>
                    <div style="margin:4px 0;">
                        {red_balls_html}  <span style="color:#6b7280;">+</span>  {blue_ball_html}
                    </div>
                    <div style="color:#6b7280;font-size:12px;line-height:1.5;">
                        {desc}
                    </div>
                </div>
            """)

        html_parts.append("</div></div>")

    # 免责声明
    html_parts.append(f"""
        <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;
                    padding:12px 18px;font-size:12px;color:#92400e;margin:14px 0;">
            ⚠️ <strong>免责声明：</strong>AI 预测结果仅供参考，彩票开奖具有随机性，
            不构成任何投资建议，请理性购彩。
        </div>
        <div style="text-align:center;color:#9ca3af;font-size:11px;
                    padding:12px 0 20px;">
            {SENDER_NAME} · 自动推送 · {now}
        </div>
    </div>
    """)

    return "\n".join(html_parts)


# ==================== 邮件发送 ====================

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


# ==================== 主流程 ====================

def main():
    print("=" * 50)
    print("  双色球 AI 预测 — 邮箱推送")
    print("=" * 50)

    # 检查配置
    check_config()

    # 加载数据
    print("\n📂 加载数据...")
    lottery_data = load_json(LOTTERY_HISTORY_FILE)
    predictions_data = load_json(AI_PREDICTIONS_FILE)

    # 构建邮件内容
    print("📝 构建邮件内容...")
    target_period = predictions_data.get("target_period", "?")
    subject = f"[双色球AI预测] 第{target_period}期预测推送"
    html_body = build_email_content(predictions_data, lottery_data)

    # 发送邮件
    print("\n📤 发送邮件...")
    success = send_email(subject, html_body, dry_run=DRY_RUN)

    if not success:
        sys.exit(1)
    print("\n✨ 完成")


if __name__ == "__main__":
    main()
