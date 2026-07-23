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
 * Generate initial diagnostic analysis for Admin/Staff when user posts their issue.
 */
async function generateStaffAnalysis(userMessage, category = 'Support', userName = 'User') {
    const systemPrompt = `Bạn là Trợ Lý AI Chẩn Đoán Kỹ Thuật của Ticketary Bot.
Nhiệm vụ của bạn là phân tích mô tả sự cố của người dùng và tạo Báo Cáo Chẩn Đoán & Khuyên NGHỊ dành cho Admin / Support Staff.
- Thể loại vé: ${category}
- Người gửi vé: ${userName}

Định dạng báo cáo dành riêng cho Staff:
1. 🔍 **Tóm tắt sự cố người dùng**: Tóm tắt ngắn gọn vấn đề/thắc mắc.
2. 📌 **Dự đoán nguyên nhân**: Đưa ra 1-2 nguyên nhân chính gây ra vấn đề này.
3. 💡 **Hướng giải quyết đề xuất cho Staff**: Các bước cụ thể hỗ trợ Staff xử lý nhanh cho người dùng.
4. ❓ **Thông tin cần hỏi thêm (nếu có)**: Các câu hỏi Staff nên hỏi thêm nếu người dùng mô tả chưa đủ.

Giữ báo cáo chuyên nghiệp, ngắn gọn, súc tích (dưới 350 từ) bằng tiếng Việt.`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
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
    generateStaffAnalysis,
    generateStaffAssistance
};
