
/* eslint-disable no-undef */
import React, { useState, useEffect } from "react";
import LessonSelector from "../component/LessonSelector";
import EvaluationSelector from "../component/EvaluationSelector";
import CommentGenerator from "../component/CommentGenerator";
import "./../popup/popup.css";

const options = ["Yếu", "Trung bình", "Khá", "Giỏi", "Xuất sắc"];

export default function Popup() {
  const [selected, setSelected] = useState(options[0]);
  const [customInput, setCustomInput] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");

  const [lessonsData, setLessonsData] = useState({});
  const [subject, setSubject] = useState("");
  const [course, setCourse] = useState("");
  const [session, setSession] = useState("");
  const [lessonContent, setLessonContent] = useState([]);

  useEffect(() => {
    fetch(chrome.runtime.getURL("lessons.json"))
      .then((res) => res.json())
      .then((data) => setLessonsData(data))
      .catch((err) => {
        console.error("Không thể load lessons.json:", err);
        setStatus("Lỗi khi tải nội dung bài học.");
      });
  }, []);

  const injectLessonContentToPage = (contentArr) => {
    const content = contentArr.join("\n");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (content) => {
          const editor = document.querySelector(
            "div.ql-editor[contenteditable='true']"
          );
          if (editor) {
            editor.innerHTML = content
              .split("\n")
              .map((line) => `<p>${line}</p>`)
              .join("");
            editor.dispatchEvent(new Event("input", { bubbles: true }));
          }
        },
        args: [content],
      });
    });
  };

  const handleLoadLessonFromFile = () => {
    if (!subject || !course || !session) {
      setStatus("Vui lòng chọn đủ Môn học, Khóa học và Buổi học.");
      return;
    }

    const lesson = lessonsData?.[subject]?.[course]?.[session];
    if (lesson) {
      const contentArray = Array.isArray(lesson) ? lesson : lesson.split("\n");
      setLessonContent(contentArray);
      injectLessonContentToPage(contentArray);
      setStatus("Đã tìm và điền nội dung bài học!");
    } else {
      setLessonContent([]);
      setStatus("Không tìm thấy nội dung cho lựa chọn này.");
    }
  };

  const handleRun = () => {
    setStatus(" Đang tích nhận xét...");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (selectedLevel) => {
          const levelMap = {
            Yếu: 0,
            "Trung bình": 1,
            Khá: 2,
            Giỏi: 3,
            "Xuất sắc": 4,
          };
          const index = levelMap[selectedLevel];
          if (index === undefined) return;
          const rows = document.querySelectorAll('div[class^="jss"]');
          rows.forEach((row) => {
            const radios = row.querySelectorAll('input[type="radio"]');
            if (radios.length > index) {
              radios[index].click();
            }
          });
        },
        args: [selected],
      });
      setTimeout(() => setStatus("Đã tích xong!"), 1000);
    });
  };

  const parseClassCode = (className) => {
    if (!className) return null;
    const upperName = className.toUpperCase();

    const mapping = {
      // Scratch
      SB: { subject: "Scratch", course: "Basic" },
      SA: { subject: "Scratch", course: "Advance" },
      SI: { subject: "Scratch", course: "Internship" },
      // Game Maker
      GB: { subject: "Game Maker", course: "Basic" },
      GA: { subject: "Game Maker", course: "Advance" },
      GI: { subject: "Game Maker", course: "Internship" },
      // App (Python)
      PTB: { subject: "App", course: "Basic" },
      PTA: { subject: "App", course: "Advance" },
      PTI: { subject: "App", course: "Internship" },
      // Web
      JSB: { subject: "Web", course: "Basic" },
      JSA: { subject: "Web", course: "Advance" },
      JSI: { subject: "Web", course: "Internship" },
    };

    // Sort keys by length descending to match longest first (e.g. JSB before SB though JSB is unique)
    // Actually no overlap issue in current set but good practice.
    const keys = Object.keys(mapping).sort((a, b) => b.length - a.length);

    for (const code of keys) {
      if (upperName.includes(code)) {
        return mapping[code];
      }
    }

    return null;
  };

  const handleAutoDetect = () => {
    setStatus("Đang quét thông tin trang...");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          func: () => {
            const classElement = document.querySelector("header h6");
            const activeSessionElement = document.querySelector(
              'div[id^="class-comments-slot-carousel-"].active .info-container > div:first-child'
            );
            
            return {
              className: classElement ? classElement.innerText : "",
              sessionText: activeSessionElement ? activeSessionElement.innerText : ""
            };
          },
        },
        (results) => {
          if (results && results[0] && results[0].result) {
            const { className, sessionText } = results[0].result;
            const parsedInfo = parseClassCode(className);
            
            if (parsedInfo) {
              setSubject(parsedInfo.subject);
              setCourse(parsedInfo.course);
            } else if (className) {
               // Fallback if not found in map
               setSubject(className.split("-")[1] || "MindX");
            }

            if (sessionText) {
              const sessionNum = sessionText.replace("#", "").trim();
              setSession(`Buổi ${sessionNum}`);
            }
            
            const detectedSub = parsedInfo ? parsedInfo.subject : "Unknown";
            const detectedCourse = parsedInfo ? parsedInfo.course : "Unknown";

            setStatus(`Lớp: ${className} -> ${detectedSub} - ${detectedCourse} | Buổi ${sessionText?.replace("#", "")}`);
          } else {
            setStatus("Không tìm thấy thông tin lớp học trên trang này.");
          }
        }
      );
    });
  };

  const handleGenerate = () => {
    if (!customInput.trim()) {
      setStatus("Vui lòng nhập nội dung yêu cầu trước.");
      return;
    }

    const lesson = lessonsData?.[subject]?.[course]?.[session];
    let lessonContent = "";
    if (lesson) {
      lessonContent = Array.isArray(lesson) ? lesson.join("\n") : lesson;
    }

    setStatus("Đang tạo nhận xét...");
    const prompt = `Bạn là một giáo viên MindX tâm huyết và chuyên nghiệp.
    Hãy viết nhận xét chi tiết cho học viên với thông tin sau:
    - Môn học: ${subject}
    - Khóa học: ${course}
    - Buổi học: ${session}
    - Nội dung bài: ${lessonContent}

    Dựa trên các ý nhận xét thô: "${customInput}"

    Yêu cầu đầu ra:
    1. Văn phong: Chuyên nghiệp, ân cần, mang tính xây dựng và khích lệ (Growth Mindset).
    2. Cấu trúc rõ ràng, mạch lạc:
       - Phần 1: Ghi nhận sự cố gắng và điểm mạnh của học viên trong buổi học.
       - Phần 2: Đánh giá chi tiết dựa trên 'Nội dung bài' và 'nhận xét thô' đã cung cấp.
       - Phần 3: Lời khuyên cụ thể hoặc lời động viên cho các buổi sau.
    3. Trình bày: Chia đoạn tách bạch để dễ đọc. Sử dụng gạch đầu dòng (-) nếu cần liệt kê các điểm cụ thể.
    `;
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

    chrome.runtime.sendMessage(
      { action: "generateComment", prompt, apiKey },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus("Lỗi: " + chrome.runtime.lastError.message);
          return;
        }

        if (response?.comment) {
          const comment = response.comment.trim();
          setComment(comment);
          setStatus("Đã tạo xong! Đang điền và lưu...");
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: (comment) => {
                // 1. Fill Content
                const editor = document.querySelector(
                  "div.ql-editor[contenteditable='true']"
                );
                if (editor) {
                  editor.innerHTML = comment
                    .split("\n")
                    .map((line) => `<p>${line}</p>`)
                    .join("");
                  editor.dispatchEvent(new Event("input", { bubbles: true }));
                } else {
                  console.error("Không tìm thấy ô nhập liệu .ql-editor");
                  return;
                }

                // 2. Click Save Button
                // Strategy: Find button with "Save" text inside span
                const buttons = Array.from(document.querySelectorAll("button"));
                const saveBtn = buttons.find((btn) => 
                  btn.innerText.includes("Save") || 
                  btn.querySelector(".MuiButton-label")?.innerText === "Save"
                );

                if (saveBtn) {
                  setTimeout(() => {
                    saveBtn.click();
                  }, 500); // Wait a bit for React to process the input
                } else {
                  console.error("Không tìm thấy nút Save");
                }
              },
              args: [comment],
            });
          });
        } else {
          setStatus("Lỗi GPT: " + (response?.error || "Không có phản hồi."));
        }
      }
    );

  };

  return (
    <div className="popup-container">
      <LessonSelector
        lessonsData={lessonsData}
        subject={subject}
        course={course}
        session={session}
        lessonContent={lessonContent}
        setSubject={setSubject}
        setCourse={setCourse}
        setSession={setSession}
        setLessonContent={setLessonContent}
        setStatus={setStatus}
        handleLoadLessonFromFile={handleLoadLessonFromFile}
      />
      <EvaluationSelector
        selected={selected}
        setSelected={setSelected}
        handleRun={handleRun}
      />
      
      <div style={{ textAlign: "center", margin: "10px 0" }}>
          <button onClick={handleAutoDetect} className="popup-button" style={{backgroundColor: "#4CAF50"}}>
            Tự động lấy thông tin lớp
          </button>
      </div>

      <CommentGenerator
        customInput={customInput}
        setCustomInput={setCustomInput}
        handleGenerate={handleGenerate}
        comment={comment}
      />
      {status && <p className="popup-status">{status}</p>}
    </div>
  );
}
