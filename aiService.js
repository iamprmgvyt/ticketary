const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Candidate models to try in order
const MODELS = [
    process.env.NVIDIA_MODEL || 'thinkingmachines/inkling',
    'meta/llama-3.1-70b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'mistralai/mistral-7b-instruct-v0.3'
];

async function callNvidiaAI(messages, maxTokens = 2048) {
    const apiKey = process.env.NVIDIA_API_KEY || NVIDIA_API_KEY;
    if (!apiKey) {
        console.error('❌ AI Service: NVIDIA_API_KEY is missing.');
        return null;
    }

    for (const modelName of MODELS) {
        try {
            console.log(`🤖 AI Engine: Requesting model "${modelName}"...`);
            const response = await fetch(NVIDIA_BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: messages,
                    temperature: 0.7,
                    top_p: 0.95,
                    max_tokens: maxTokens,
                    stream: false
                })
            });

            if (response.ok) {
                const data = await response.json();
                const aiContent = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
                if (aiContent && aiContent.trim().length > 0) {
                    console.log(`✅ AI Engine: Successfully generated response using "${modelName}".`);
                    return aiContent;
                }
            } else {
                const errText = await response.text();
                console.warn(`⚠️ Model "${modelName}" failed [${response.status}]: ${errText}`);
            }
        } catch (err) {
            console.error(`❌ Model "${modelName}" error:`, err.message);
        }
    }
    return null;
}

/**
 * Handles the multi-turn AI Auto-Interview (Up to 5 questions) for ticket creators.
 */
async function generateAIInterviewStep(history, category = 'Support', userName = 'User', questionCount = 1) {
    const systemPrompt = `Bạn là Trợ Lý AI Hỗ Trợ Tự Động của Ticketary đang thu thập thông tin từ người dùng (${userName}) trong vé [${category}].
Lần trao đổi hiện tại: ${questionCount}/5.

Quy tắc làm việc:
1. Nếu thông tin người dùng cung cấp ĐÃ ĐỦ HOẶC ${questionCount} >= 5:
   Hãy xuất Báo Cáo Phân Tích Kỹ Thuật Dành Cho Staff theo đúng cấu trúc bên dưới (và KHÔNG hỏi thêm nữa):
   ---SUMMARY_START---
   🔍 **Tóm tắt sự cố**: (tóm tắt nội dung lỗi)
   📌 **Dự đoán nguyên nhân**: (1-2 nguyên nhân khả thi)
   💡 **Hướng xử lý đề xuất cho Staff**: (các bước hỗ trợ cụ thể)
   ❓ **Thông tin bổ sung cho Staff**: (nếu có)
   ---SUMMARY_END---

2. Nếu thông tin người dùng cung cấp CÒN THIẾU và ${questionCount} < 5:
   Hãy đưa ra 1 câu hỏi làm rõ tiếp theo (Câu hỏi ${questionCount + 1}/5) thật ngắn gọn, lịch sự bằng tiếng Việt (hoặc ngôn ngữ người dùng). Thân thiện và hỗ trợ người dùng tối đa.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history
    ];

    return await callNvidiaAI(messages, 2048);
}

/**
 * Generate AI assistance when Admin/Staff pings the bot in a ticket channel.
 */
async function generateStaffAssistance(staffPrompt, contextInfo = '', category = 'Support', staffName = 'Staff') {
    const systemPrompt = `Bạn là Trợ Lý AI Chuyên Gia của Ticketary đang hỗ trợ Admin / Support Staff (${staffName}) trong vé hỗ trợ [${category}].
Hãy trả lời trực tiếp câu hỏi/yêu cầu của Staff một cách chính xác, ngắn gọn, đưa ra giải pháp kỹ thuật hoặc câu trả lời phù hợp nhất bằng tiếng Việt.
${contextInfo ? `Ngữ cảnh vé gần đây: ${contextInfo}` : ''}`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: staffPrompt }
    ];

    return await callNvidiaAI(messages, 2048);
}

module.exports = { 
    generateAIInterviewStep,
    generateStaffAssistance
};
