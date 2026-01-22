import React from "react";
import "./../popup/popup.css";
export default function CommentGenerator({
  customInput,
  setCustomInput,
  handleGenerate,
  comment,
}) {
  return (
    <>
      <div className="quick-rating-buttons" style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
          {[
            { label: "1", text: "Tiếp thu chậm, cần cố gắng nhiều." },
            { label: "2", text: "Tiếp thu trung bình, cần tập trung hơn." },
            { label: "3", text: "Học lực Khá, có ý thức học tập." },
            { label: "4", text: "Học lực Giỏi, tiếp thu nhanh." },
            { label: "5", text: "Xuất sắc, tư duy tốt và sáng tạo." }
          ].map((item) => (
            <button 
              key={item.label} 
              onClick={() => setCustomInput(item.text)}
              className={`popup-button ${customInput === item.text ? 'active' : ''}`}
              style={{ 
                flex: 1, 
                padding: '5px', 
                fontSize: '12px', 
                minWidth: '30px',
                backgroundColor: customInput === item.text ? '#27ae60' : '#bdc3c7',
                color: 'white',
                transition: 'all 0.2s'
              }}
              title={item.text}
            >
              {item.label}
            </button>
          ))}
      </div>
      <textarea
        value={customInput}
        onChange={(e) => setCustomInput(e.target.value)}
        placeholder="Nhập nội dung để viết nhận xét"
        className="popup-textarea"
      />
      <button onClick={handleGenerate} className="popup-button generate">Điền nhận xét</button>
      {comment && <div className="popup-comment-box">{comment}</div>}
    </>
  );
}
