
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

  const handleGenerate = () => {
    if (!customInput.trim()) {
      setStatus("Vui lòng nhập nội dung yêu cầu trước.");
      return;
    }

    setStatus("Đang tạo nhận xét...");
    const prompt = `Hãy viết một đoạn ngắn nhận xét dựa trên nội dung sau: "${customInput}".`;
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
          setStatus("Đã tạo nhận xét!");
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: (comment) => {
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
                  alert("Không tìm thấy vùng nhập liệu (.ql-editor)");
                }
              },
              args: [comment],
            });
          });
        } else {
          setStatus("GPT không trả về nội dung nhận xét.");
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
