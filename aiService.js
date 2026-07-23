const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Candidate models ordered for maximum speed & accuracy
const MODELS = [
    'meta/llama-3.1-70b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'mistralai/mistral-7b-instruct-v0.3',
    process.env.NVIDIA_MODEL || 'thinkingmachines/inkling'
];

async function callNvidiaAI(messages, maxTokens = 512) {
    const apiKey = process.env.NVIDIA_API_KEY || NVIDIA_API_KEY;
    if (!apiKey) {
        console.error('❌ AI Service: NVIDIA_API_KEY is missing.');
        return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout limit

    for (const modelName of MODELS) {
        try {
            console.log(`🤖 AI Engine: Calling fast model "${modelName}"...`);
            const response = await fetch(NVIDIA_BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: messages,
                    temperature: 0.6,
                    max_tokens: maxTokens,
                    stream: false
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const aiContent = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
                if (aiContent && aiContent.trim().length > 0) {
                    console.log(`⚡ AI Engine: Fast response received from "${modelName}".`);
                    return aiContent.trim();
                }
            } else {
                const errText = await response.text();
                console.warn(`⚠️ Model "${modelName}" error [${response.status}]: ${errText}`);
            }
        } catch (err) {
            console.error(`❌ Model "${modelName}" error:`, err.message);
        }
    }
    return null;
}

/**
 * Fast multi-turn interview prompt (Max 5 questions)
 */
async function generateAIInterviewStep(history, category = 'Support', userName = 'User', questionCount = 1) {
    const systemPrompt = `Bạn là AI trợ lý ticket [${category}] hỗ trợ user (${userName}). Đang ở câu (${questionCount}/5).

Nhiệm vụ:
- Nếu thông tin ĐÃ ĐỦ hoặc ${questionCount} >= 5: Xuất báo cáo duy nhất dạng:
---SUMMARY_START---
🔍 **Tóm tắt sự cố**: <tóm tắt ngắn>
📌 **Nguyên nhân dự đoán**: <1-2 ý>
💡 **Đề xuất cho Staff**: <bước xử lý>
---SUMMARY_END---

- Nếu chưa đủ và ${questionCount} < 5: Đặt duy nhất 1 câu hỏi làm rõ tiếp theo (Câu ${questionCount + 1}/5) ngắn gọn bằng tiếng Việt.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6) // Keep last 6 exchanges for speed
    ];

    return await callNvidiaAI(messages, 512);
}

/**
 * Fast AI assistance when staff pings @Ticketary
 */
async function generateStaffAssistance(staffPrompt, contextInfo = '', category = 'Support', staffName = 'Staff') {
    const systemPrompt = `Bạn là AI trợ lý chuyên gia ticket [${category}] cho Staff (${staffName}). Trả lời ngắn gọn, chính xác bằng tiếng Việt.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: staffPrompt }
    ];

    return await callNvidiaAI(messages, 512);
}

module.exports = { 
    generateAIInterviewStep,
    generateStaffAssistance
};
