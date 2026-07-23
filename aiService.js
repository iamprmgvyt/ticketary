const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

// Candidate models to try in order
const MODELS = [
    process.env.NVIDIA_MODEL || 'thinkingmachines/inkling',
    'meta/llama-3.1-70b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'mistralai/mistral-7b-instruct-v0.3'
];

/**
 * Generate an AI Auto-Reply for ticket queries using NVIDIA NIM API.
 */
async function generateAIReply(userMessage, category = 'Support', userName = 'User') {
    const apiKey = process.env.NVIDIA_API_KEY || NVIDIA_API_KEY;
    if (!apiKey) {
        console.error('❌ AI Service: NVIDIA_API_KEY is missing.');
        return null;
    }

    const systemPrompt = `Bạn là Trợ Lý AI Hỗ Trợ Tự Động của Ticketary (Discord Ticket Bot).
Nhiệm vụ của bạn là phân tích và phản hồi ban đầu khi người dùng vừa gửi câu hỏi trong vé hỗ trợ (Ticket).
- Thể loại vé: ${category}
- Tên người dùng: ${userName}
- Quy tắc phản hồi:
1. Chào hỏi người dùng lịch sự, thân thiện.
2. Phân tích chi tiết câu hỏi/vấn đề mà người dùng vừa mô tả.
3. Cung cấp câu trả lời, giải pháp hoặc các bước hướng dẫn ban đầu thật chính xác, ngắn gọn, dễ hiểu bằng tiếng Việt (hoặc cùng ngôn ngữ với người dùng).
4. Nhắc người dùng rằng đội ngũ Hỗ trợ (Support Staff) đã được thông báo và sẽ đồng hành hỗ trợ thêm nếu họ cần.
5. Định dạng câu trả lời đẹp mắt bằng Markdown (bullet points, bold text). Giữ độ dài súc tích (dưới 350 từ).`;

    for (const modelName of MODELS) {
        try {
            console.log(`🤖 AI Auto-Reply: Trying model "${modelName}"...`);
            const response = await fetch(NVIDIA_BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.7,
                    top_p: 0.95,
                    max_tokens: 2048,
                    stream: false
                })
            });

            if (response.ok) {
                const data = await response.json();
                const aiContent = data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
                if (aiContent && aiContent.trim().length > 0) {
                    console.log(`✅ AI Auto-Reply: Successfully generated response using model "${modelName}".`);
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

module.exports = { generateAIReply };
