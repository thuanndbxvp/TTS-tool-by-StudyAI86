
/**
 * Chia văn bản thành các đoạn nhỏ dựa trên dấu câu và độ dài mục tiêu.
 * Giúp tránh việc tạo ra các file audio quá ngắn do xuống dòng tùy tiện (VD: copy từ PDF).
 */
export function splitTextSmartly(text: string): string[] {
    if (!text) return [];
  
    // 1. Chuẩn hóa khoảng trắng: thay thế xuống dòng và nhiều khoảng trắng thành 1 khoảng trắng
    // Điều này biến văn bản thành 1 dòng liên tục để xử lý ngữ nghĩa tốt hơn
    const normalizedText = text.replace(/\s+/g, ' ').trim();
  
    if (!normalizedText) return [];
  
    // 2. Tách thành các câu dựa trên dấu kết thúc câu (. ? ! ; :)
    // Regex này tìm dấu câu, thay thế nó bằng "Dấu câu|SPLIT|", sau đó tách chuỗi.
    const sentenceDelimiters = /([.?!;:]+)(?=\s+|$)/g;
    const sentences = normalizedText
      .replace(sentenceDelimiters, "$1|SPLIT|")
      .split("|SPLIT|")
      .map(s => s.trim())
      .filter(s => s.length > 0);
  
    const chunks: string[] = [];
    let currentChunk = "";
    
    // Ngưỡng mềm: Cố gắng ngắt ở khoảng này nếu gặp dấu câu.
    // Tăng lên 1000 ký tự (khoảng 200-250 từ tiếng Việt) để giữ mạch văn liền mạch hơn.
    const SOFT_LIMIT = 1000; 
    // Ngưỡng cứng: Nếu một câu quá dài không có dấu câu, buộc phải cắt.
    const HARD_LIMIT = 3000;
  
    for (const sentence of sentences) {
      // Nếu thêm câu này vào mà vẫn dưới ngưỡng mềm, hoặc chunk hiện tại đang rỗng
      if (
           (currentChunk.length + sentence.length <= SOFT_LIMIT) || 
           (currentChunk.length === 0)
         ) {
        currentChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence;
      } else {
        // Chunk hiện tại đã đủ dài, đẩy vào danh sách và bắt đầu chunk mới
        chunks.push(currentChunk);
        currentChunk = sentence;
      }
      
      // Xử lý trường hợp đặc biệt: Câu hiện tại quá dài (VD: văn bản không dấu câu)
      // Chúng ta sẽ cắt dựa trên khoảng trắng (số lượng từ)
      if (currentChunk.length > HARD_LIMIT) {
           const words = currentChunk.split(' ');
           let tempChunk = "";
           // Reset currentChunk vì chúng ta sẽ đẩy từng phần nhỏ vào chunks
           currentChunk = ""; 
           
           for(const word of words) {
               if((tempChunk.length + word.length) > SOFT_LIMIT) {
                   chunks.push(tempChunk.trim());
                   tempChunk = word;
               } else {
                   tempChunk = tempChunk ? `${tempChunk} ${word}` : word;
               }
           }
           // Gán phần dư còn lại vào currentChunk để tiếp tục vòng lặp tiếp theo
           currentChunk = tempChunk;
      }
    }
  
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
  
    return chunks;
  }
