from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import openai
import os

from ..database import get_db
from ..models import Machine, Prediction, MaintenanceTask
from ..schemas import AssistantQuery, AssistantResponse

# Initialize OpenAI client with the Groq API configuration
openai_client = openai.AsyncOpenAI(
    api_key=os.environ.get("GROQ_API_KEY", ""),
    base_url="https://api.groq.com/openai/v1"
)

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/query", response_model=AssistantResponse)
async def query_assistant(payload: AssistantQuery, db: AsyncSession = Depends(get_db)):
    query = payload.query.lower().strip()

    # --- Fetch data for context ---
    sub = (
        select(Prediction.machine_id, func.max(Prediction.predicted_at).label("max_at"))
        .group_by(Prediction.machine_id)
        .subquery()
    )
    preds_result = await db.execute(
        select(Prediction).join(
            sub,
            (Prediction.machine_id == sub.c.machine_id)
            & (Prediction.predicted_at == sub.c.max_at),
        )
    )
    preds = preds_result.scalars().all()

    tasks_result = await db.execute(
        select(MaintenanceTask)
        .where(MaintenanceTask.status == "pending")
        .order_by(MaintenanceTask.created_at.desc())
        .limit(20)
    )
    pending_tasks = tasks_result.scalars().all()

    high_risk = [p for p in preds if p.risk_level == "High"]
    medium_risk = [p for p in preds if p.risk_level == "Medium"]
    low_health = [p for p in preds if p.health_score < 40]
    avg_health = round(sum(p.health_score for p in preds) / len(preds), 1) if preds else 0
    shortest = sorted(preds, key=lambda x: x.rul)[:5]

    # Dynamically build fleet context for OpenAI
    recent_tasks_str = "\n".join([f"- {t.title} ({t.priority}) for {t.machine_id}" for t in pending_tasks[:5]])
    high_risk_str = ", ".join([p.machine_id for p in high_risk[:5]]) if high_risk else "None"
    closest_fail_str = "\n".join([f"- {p.machine_id}: RUL {p.rul:.0f} cycles (Failure: {p.predicted_failure_date})" for p in shortest])

    system_prompt = f"""
You are the primary AI Maintenance Assistant for the MaintainXx Predictive Maintenance Intelligence System.
Your job is to assist factory managers and maintenance technicians by answering questions about fleet status and maintenance tasks.

Here is the live real-time state of the machinery fleet right now (based on NASA CMAPSS telemetry):
- Total Monitored Machines: {len(preds)}
- Fleet Average Health: {avg_health}%
- High Risk Machines: {len(high_risk)}. The most critical are: {high_risk_str}
- Machines closest to failure:
{closest_fail_str}

- Pending Maintenance Tasks ({len(pending_tasks)} total):
{recent_tasks_str}

**Instructions:**
1. Be helpful, concise, and professional.
2. Direct the user's attention to High Priority tasks or High Risk machines if they ask general questions.
3. If they ask about a specific machine from the context, provide its details.
4. Format your response clearly using markdown bullet points and bold text where appropriate.
5. You can use standard emojis to make the response approachable (e.g. 🚨, ⏳, 🔧).
"""

    machines_ref = [p.machine_id for p in high_risk[:3]]
    suggestions = ["Schedule maintenance for high-risk assets", "Review top pending tasks", "Check predictive health trends"]

    try:
        response = await openai_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            temperature=0.3,
            max_tokens=400
        )
        answer = response.choices[0].message.content
    except Exception as e:
        # Fallback to local rule-based NLU if OpenAI key runs out of credits (e.g. 429 Insufficient Quota)
        answer = ""
        q_lower = query.lower()
        if any(kw in q_lower for kw in ["high risk", "critical", "danger"]):
            if high_risk:
                answer = (f"🚨 ⚠️ **OpenAI Limit Reached - Using Local AI**\n\nThere are **{len(high_risk)} high-risk machines** requiring immediate attention.\n\n" +
                          "\n".join(f"- **{p.machine_id}**: RUL={p.rul:.0f} cycles, Health={p.health_score:.0f}%" for p in sorted(high_risk, key=lambda x: x.rul)[:5]))
            else:
                answer = "✅ ⚠️ **OpenAI Limit Reached - Using Local AI**\n\nNo machines are currently at high-risk. Fleet looks healthy!"
        elif any(kw in q_lower for kw in ["maintain today", "today", "schedule"]):
            today_tasks = [t for t in pending_tasks if t.priority in ("critical", "high")]
            if today_tasks:
                answer = (f"📋 ⚠️ **OpenAI Limit Reached - Using Local AI**\n\n**{len(today_tasks)} high-priority tasks** need attention today:\n\n" +
                          "\n".join(f"- **{t.machine_id}**: {t.title} (due {t.due_date})" for t in today_tasks[:8]))
            else:
                answer = "✅ ⚠️ **OpenAI Limit Reached - Using Local AI**\n\nNo urgent tasks scheduled for today."
        elif any(kw in q_lower for kw in ["health", "average", "status", "overall"]):
            answer = (f"📊 ⚠️ **OpenAI Limit Reached - Using Local AI**\n\n**Fleet Health Summary:**\n\n"
                      f"- Total machines: **{len(preds)}**\n- Average health: **{avg_health}%**\n"
                      f"- High risk: **{len(high_risk)}**\n- Low health (<40%): **{len(low_health)}**")
        elif any(kw in q_lower for kw in ["rul", "remaining", "life", "fail", "soonest"]):
            answer = ("⏳ ⚠️ **OpenAI Limit Reached - Using Local AI**\n\n**Machines closest to failure (lowest RUL):**\n\n" +
                      "\n".join(f"- **{p.machine_id}**: {p.rul:.0f} cycles remaining (est. {p.predicted_failure_date})" for p in shortest))
        else:
            answer = ("🤖 ⚠️ **OpenAI Quota Exceeded. Using Off-line Assistant:**\n\n"
                      "I can still help you with:\n"
                      "- **Which machines are at high risk?**\n"
                      "- **What should be maintained today?**\n"
                      "- **What's the overall fleet health?**\n"
                      "- **Which machines will fail soonest?**")

    return AssistantResponse(
        answer=answer,
        machines_referenced=machines_ref,
        suggested_actions=suggestions,
    )
