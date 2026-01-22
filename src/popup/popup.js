
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

    const keys = Object.keys(mapping).sort((a, b) => b.length - a.length);

    for (const code of keys) {
      const regex = new RegExp(`\\b${code}(?![a-zA-Z])`, "i");
      if (regex.test(className)) {
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
            const h6Elements = document.querySelectorAll("header h6");
            let classText = "";
            
            for (const h6 of h6Elements) {
                if (h6.innerText.includes("-")) {
                    classText = h6.innerText;
                    break;
                }
            }
            
            if (!classText && h6Elements.length > 1) {
                
            }
            
            if (!classText && h6Elements.length > 0) {
                 classText = h6Elements[0].innerText;
            }

            const activeSessionElement = document.querySelector(
              'div[id^="class-comments-slot-carousel-"].active .info-container > div:first-child'
            );
            
            return {
              className: classText,
              sessionText: activeSessionElement ? activeSessionElement.innerText : ""
            };
          },
        },
        (results) => {
          if (results && results[0] && results[0].result) {
            const { className, sessionText } = results[0].result;
            const parsedInfo = parseClassCode(className);
            
            let detectedSubject = "";
            let detectedCourse = "";
            let detectedSession = "";

            if (parsedInfo) {
              detectedSubject = parsedInfo.subject;
              detectedCourse = parsedInfo.course;
              setSubject(detectedSubject);
              setCourse(detectedCourse);
            } else if (className) {
               detectedSubject = className.split("-")[1]?.trim() || "MindX";
               setSubject(detectedSubject);
            }

            if (sessionText) {
              const sessionNum = sessionText.replace("#", "").trim();
              detectedSession = `Buổi ${sessionNum}`;
              setSession(detectedSession);
            }
            
            // Auto load content if match found
            let extraMsg = "";
            if (detectedSubject && detectedCourse && detectedSession) {
                const lesson = lessonsData?.[detectedSubject]?.[detectedCourse]?.[detectedSession];
                if (lesson) {
                    const contentArray = Array.isArray(lesson) ? lesson : lesson.split("\n");
                    setLessonContent(contentArray);
                    extraMsg = "(Đã load nội dung)";
                } else {
                    setLessonContent([]);
                    extraMsg = "(Không có nội dung)";
                }
            }
            
            setStatus(`Raw: [${className}] | [${sessionText}] \n=> ${detectedSubject} - ${detectedCourse} | ${detectedSession} ${extraMsg}`);

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
    const prompt = `Bạn là giáo viên MindX. Viết nhận xét ngắn gọn, súc tích (khoảng 3-4 ý chính) cho học viên:
    - Lớp: ${subject} - ${course} (${session})
    - Nội dung bài: ${lessonContent}
    - Ý nhận xét: "${customInput}"

    Yêu cầu bắt buộc:
    1. Ngắn gọn, đi thẳng vào vấn đề.
    2. MỖI Ý VIẾT TRÊN 1 DÒNG RIÊNG BIỆT (bắt buộc xuống dòng).
    3. Luôn dùng gạch đầu dòng (-) ở đầu mỗi ý.
    4. Bao gồm: 
       - Ghi nhận nỗ lực/Tinh thần học tập.
       - Nhận xét mức độ hiểu bài/Kiến thức đã học.
       - Lời khuyên/Động viên ngắn gọn nếu kiến thức chưa vững.
    5. Viết dưới xưng hô "Thầy"
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
