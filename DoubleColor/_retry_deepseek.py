# -*- coding: utf-8 -*-
import json, os, sys
from openai import OpenAI

client = OpenAI(api_key="sk-vtZ2I1JrbaVqIlgTihcglVTnvdPRJYAs", base_url="https://token.sensenova.cn/v1")

with open("doc/prompt2.0.md", "r", encoding="utf-8") as f:
    prompt_template = f.read()

with open("data/lottery_history.json", "r", encoding="utf-8") as f:
    lh = json.load(f)

history_json = json.dumps(lh.get("data", [])[:30], ensure_ascii=False, indent=2)
next_draw = lh.get("next_draw", {})

prompt = prompt_template.format(
    target_period=next_draw.get("next_period", "26088"),
    target_date=next_draw.get("next_date_display", "2026年08月02日"),
    lottery_history=history_json,
    prediction_date="2026-08-02",
    model_id="DeepseekR1",
    model_name="DeepSeek R1"
)

print("正在调用 sensenova-6.7-flash-lite 生成 DeepSeek R1 预测...")
response = client.chat.completions.create(
    model="sensenova-6.7-flash-lite",
    messages=[
        {"role": "system", "content": "你是一个专业的彩票数据分析师，擅长基于历史数据进行模式分析和预测。请严格按照要求返回 JSON 格式数据，不要有任何额外的解释或说明。"},
        {"role": "user", "content": prompt}
    ],
    temperature=0.8
)
text = response.choices[0].message.content.strip()
print(f"响应长度: {len(text)} 字符")

# Extract JSON
if "```json" in text:
    start = text.find("```json") + 7
    end = text.find("```", start)
    text = text[start:end].strip()
elif "```" in text:
    start = text.find("```") + 3
    end = text.find("```", start)
    text = text[start:end].strip()

pred = json.loads(text)
print(f"JSON 解析成功")
print(f"  期号: {pred.get('target_period')}")
print(f"  模型: {pred.get('model_name')}")
print(f"  预测组数: {len(pred.get('predictions', []))}")

# Load current predictions
with open("data/ai_predictions.json", "r", encoding="utf-8") as f:
    ap = json.load(f)

# Remove existing DeepSeek R1
ap["models"] = [m for m in ap["models"] if m.get("model_id") != "DeepseekR1"]

pred["prediction_date"] = ap["prediction_date"]
pred["target_period"] = ap["target_period"]
ap["models"].append(pred)

with open("data/ai_predictions.json", "w", encoding="utf-8") as f:
    json.dump(ap, f, ensure_ascii=False, indent=2)

print(f"已保存 DeepSeek R1 预测")
print(f"当前模型数: {len(ap['models'])}")
for m in ap["models"]:
    print(f"  - {m.get('model_name')} ({m.get('model_id')})")
