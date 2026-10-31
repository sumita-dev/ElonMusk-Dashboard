# SPEC: CREATOR COMMAND CENTER (CCC)
> **First Principles OS for YouTube & Social Media Marketers**  
> **Phiên bản:** 2.0 (Complete Specification)  
> **Tác giả:** Chief Orchestrator & Sếp  
> **Kiến trúc mục tiêu:** Single-file HTML (`index.html`) + Tailwind CSS + SortableJS + LocalStorage + Gemini/LLM REST API.

---

## 1. TỔNG QUAN & TRIẾT LÝ THIẾT KẾ

### 1.1. Triết lý First Principles (Elon Musk Algorithm)
Hệ thống được thiết kế dựa trên thuật toán 5 bước của Elon Musk nhằm loại bỏ sự trì hoãn và tối đa hóa sản lượng nội dung:
1. **Đặt câu hỏi cho từng yêu cầu (Question Every Requirement):** Mọi ý tưởng đều phải xuất phát từ nguyên lý gốc (First Principle), không làm vì "người khác cũng làm".
2. **Xóa bỏ phần thừa (Delete Any Part You Can):** Ưu tiên xóa video/ý tưởng kém hiệu quả trước khi cố gắng tối ưu (CTR < 2% -> Xóa hoặc Tái chế).
3. **Đơn giản hóa & Tập trung tối đa (Simplify & Single Focus):** Chỉ duy nhất **1 nội dung** được active tại một thời điểm (`SINGLE FOCUS`).
4. **Tăng tốc chu kỳ lặp (Accelerate Cycle Time):** Time-blocking 90 phút (chu kỳ Ultradian) chia nấc 5 phút để hoàn tất deep work.
5. **Tự động hóa có chọn lọc (Automate):** AI chỉ đóng vai trò trợ lý phản biện, tạo hook và tái chế nội dung.

### 1.2. Ngôn ngữ Thiết kế Chuẩn Apple (Apple-Inspired Design Language — macOS/iOS HIG)
Giao diện ứng dụng được trau chuốt theo tinh thần tối giản sang trọng của Apple (Human Interface Guidelines):
* **Typography & Text Rendering:**
  * System Font Stack ưu tiên macOS/iOS kết hợp Google Fonts hiện đại: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", "Segoe UI", Roboto, sans-serif`.
  * **Dynamic Google Fonts Typography (AC-15)**: Tích hợp font Google Fonts tối ưu theo ngôn ngữ hiển thị — Tiếng Việt sử dụng font `Be Vietnam Pro` (chuẩn dấu tiếng Việt sắc nét, chuẩn Apple HIG), Tiếng Anh sử dụng font `Inter` (typography hiện đại, tối giản), tự động chuyển đổi linh hoạt qua CSS variable `--font-primary` theo thiết lập ngôn ngữ mà không cần reload trang.
  * Khử răng cưa tối đa (`-webkit-font-smoothing: antialiased`).
  * Tiêu đề lớn áp dụng negative letter-spacing (`tracking-tight`), phân cấp thị giác rành mạch (Primary 95%, Secondary 60%, Tertiary 40% opacity).
* **Vật liệu & Chiều sâu (Materials & Frosted Glass):**
  * Nền tối sâu thẳm (Pure Dark Canvas: `#000000` / `#090A0F`) kết hợp ánh sáng mờ ambient nhẹ.
  * Hiệu ứng kính mờ đặc trưng macOS (Translucent Frosted Glass): `backdrop-blur-xl`, nền thẻ `bg-white/[0.04]` đến `bg-white/[0.07]`.
  * Viền mảnh công nghệ hairline border: `border border-white/[0.08]` phản chiếu ánh sáng tinh tế.
* **Hình học & Bo góc (Squircle Radii):**
  * Thẻ Kanban & Container dùng bo góc mềm: `rounded-2xl` (16px) đến `rounded-3xl` (20px).
  * Nút bấm, thanh trạng thái và Badge dạng viên nhộng (Capsule/Pill buttons): `rounded-full` hoặc `rounded-xl`.
* **Cảm giác xúc giác & Tương tác vi mô (Tactile Micro-interactions):**
  * Nút bấm có hiệu ứng viền sáng nhẹ bên trong (`shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]`).
  * Phản hồi đàn hồi khi bấm: `active:scale-[0.98] transition-all duration-200 ease-out`.
  * Bộ điều khiển phân đoạn (iOS Segmented Control) cho bộ lọc nền tảng và các tab chức năng.
  * Hộp thoại Modal mở dạng Sheet mượt mà trên nền tối làm mờ quang học (`bg-black/60 backdrop-blur-md`).

---

## 2. DATA CONTRACTS & SCHEMAS

### 2.1. Card Schema (Kanban Content Item)
```typescript
interface Card {
  id: string;                    // UUID v4 tạo bằng crypto.randomUUID()
  title: string;                 // Tiêu đề video / nội dung
  platform: 'youtube' | 'facebook' | 'tiktok' | 'x';
  column: 'delete' | 'ideas' | 'single' | 'deep' | 'blocked' | 'done';
  first_principle: string;       // BẮT BUỘC: Nguyên lý gốc / Bản chất vấn đề
  goal: string;                  // Mục tiêu định lượng (VD: 100k views, 500 leads)
  metrics: {
    ctr?: number;                // Tỷ lệ nhấp (%)
    views?: number;              // Lượt xem thực tế
    retention?: number;          // Tỷ lệ giữ chân (%)
  };
  owner?: string;                // BẮT BUỘC nếu column === 'blocked' (Người giải quyết)
  eta?: string;                  // BẮT BUỘC nếu column === 'blocked' (Thời hạn giải phóng)
  learned?: string;              // BẮT BUỘC nếu column === 'done' (Bài học đúc kết)
  createdAt: number;             // Timestamp ms
  updatedAt: number;             // Timestamp ms
}
```

### 2.2. TimeBlock Schema (Tầng 1 Timeline)
```typescript
interface TimeBlock {
  id: string;                    // UUID v4
  title: string;                 // Tên công việc (Mặc định: Plan & Hook, Script, B-Roll, Film, Review)
  startTime: string;             // Định dạng "HH:mm" (8:00 - 18:00)
  durationMinutes: number;       // Thời lượng: 5, 15, 30, 45, 90 phút
  type: 'deep_work' | 'shallow' | 'review' | 'break';
  isCompleted: boolean;          // Trạng thái hoàn tất
  linkedCardId?: string;         // Liên kết với Card Kanban (nếu có)
}
```

### 2.3. DailyStats Schema (Chỉ số đo lường theo ngày)
```typescript
interface DailyStats {
  date: string;                  // "YYYY-MM-DD"
  deepWorkMinutes: number;       // Tổng số phút Deep Work tích lũy trong ngày
  tasksDeletedCount: number;     // Số lượng task đã bấm xóa hoặc chuyển vào cột Delete
  activeCardId: string | null;   // ID của card đang chạy ở Single Focus
}
```

### 2.4. AppSettings Schema (Cấu hình hệ thống)
```typescript
interface AppSettings {
  aiProvider: 'gemini' | 'groq' | 'openrouter';
  apiKey: string;                // Lưu an toàn trong localStorage
  modelName: string;             // Mặc định: 'gemini-1.5-flash' hoặc 'llama-3.3-70b-versatile'
  language: 'vi' | 'en';         // Ngôn ngữ giao diện (Mặc định: 'vi')
  fbPageId: string;              // ID Fanpage (Mặc định: "1234257116429910")
  fbPageAccessToken: string;     // Meta Graph API Page Access Token (Mã hóa / Che hiển thị)
  fbPageName: string;            // Tên Fanpage (Mặc định: "Đặt Sân Nhanh")
}
```

---

## 3. KIẾN TRÚC 3 TẦNG CHI TIẾT

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HEADER: METRICS BAR                             │
│ [⚡ Deep Work: 3.5h]  [🗑 Tasks Deleted: 4]  [⚙ Settings]  [⤓ Export] [⤒ Import]│
├────────────────────────────────────────────────────────────────────────┤
│ TẦNG 1: TIME-BLOCKING TIMELINE (08:30 - 12:20 & 13:30 - 16:30 | 60m)   │
│ [08:30 Plan & Hook] [09:35 Script Writing] [10:40 Thumbnail] [11:45]...│
├──────────────────────────────────┬─────────────────────────────────────┤
│ TẦNG 2: KANBAN BOARD (6 CỘT)     │ TẦNG 3: AI ASSISTANT (COPILOT)      │
│ 1. DELETE / REPURPOSE (<2% CTR)  │ ✦ Quick Engines:                    │
│ 2. IDEAS (Bắt buộc First Princ.) │   [Hook Generator]                  │
│ 3. SINGLE FOCUS (WIP = 1)        │   [Script Breakdown - Musk Style]   │
│ 4. DEEP WORK (WIP = 3)           │   [Deletion Advisor]                │
│ 5. BLOCKED (Cần Owner + ETA)     │   [Repurpose Engine]                │
│ 6. DONE + LEARNED (Cần Learned)  │   [Thumbnail & Title Tester]        │
│                                  │ • Chat Log Pressure Test & Copilot  │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### Tầng 1: Time-Blocking Timeline & Deep Work Tracker (Lịch làm việc thực tế của Sếp)
1. **Khung giờ làm việc & Phân định Session (AC-16, AC-21):** 
   - Thay vì dồn tất cả blocks vào một lưới phẳng đơn điệu, Tầng 1 được phân tách thành 2 vùng Session rõ ràng với màu sắc và điểm nhấn khác biệt:
     * **Session 1: CA SÁNG / MORNING SESSION (08:30 - 12:20):**
       - Màu sắc / Background: Ánh xanh dương rạng đông Apple Cupertino (`bg-gradient-to-br from-blue-500/[0.06] via-cyan-500/[0.03] to-transparent border border-blue-500/25 light:bg-blue-50/60 light:border-blue-200 rounded-2xl p-4`).
       - Header Session: Icon `🌅`, Tiêu đề `CA SÁNG / MORNING SESSION (08:30 - 12:20)`, badge thời lượng tự động tính toán (`4 Blocks • 3h 50m`).
       - Gồm 4 executive blocks:
         * `08:30 - 09:30`: Block 1 - Plan & Pattern Interrupt (60m, Deep Work)
         * *[09:30 - 09:35: Nghỉ ngắn 5 phút (Break 5m)]*
         * `09:35 - 10:35`: Block 2 - Deep Script Writing (60m, Deep Work)
         * *[10:35 - 10:40: Nghỉ ngắn 5 phút (Break 5m)]*
         * `10:40 - 11:40`: Block 3 - Thumbnail & Title A/B (60m, Review)
         * *[11:40 - 11:45: Nghỉ ngắn 5 phút (Break 5m)]*
         * `11:45 - 12:20`: Block 4 - Morning Review & Asset Prep (35m, Shallow)
     * **Dải Ngăn Cách Kính Mờ: NGHỈ TRƯA & TÁI TẠO NĂNG LƯỢNG (12:20 - 13:30):**
       - Thiết kế thanh ngăn cách kính mờ tinh tế (`🥗 12:20 - 13:30 • Nghỉ Trưa & Tái Tạo Năng Lượng / Lunch & Mental Recharge`), có icon, badge `70m Tái Tạo Năng Lượng` và đường kẻ hairline sang trọng.
     * **Session 2: CA CHIỀU / AFTERNOON SESSION (13:30 - 16:30):**
       - Màu sắc / Background: Ánh tím hoàng hôn Lavender (`bg-gradient-to-br from-purple-500/[0.06] via-indigo-500/[0.03] to-transparent border border-purple-500/25 light:bg-purple-50/60 light:border-purple-200 rounded-2xl p-4`).
       - Header Session: Icon `🌇`, Tiêu đề `CA CHIỀU / AFTERNOON SESSION (13:30 - 16:30)`, badge thời lượng tự động tính toán (`3 Blocks • 3h 00m`).
       - Gồm 3 executive blocks:
         * `13:30 - 14:30`: Block 5 - B-Roll Assembly & Production (60m, Deep Work)
         * *[14:30 - 14:35: Nghỉ ngắn 5 phút (Break 5m)]*
         * `14:35 - 15:35`: Block 6 - Filming & Voiceover (60m, Deep Work)
         * *[15:35 - 15:40: Nghỉ ngắn 5 phút (Break 5m)]*
         * `15:40 - 16:30`: Block 7 - Daily Retrospective, Repurpose & Learnings (50m, Shallow)
2. **Cảnh báo sau mỗi block 60 phút (Audio Chime & Apple Alert Banner):**
   - Khi đồng hồ Deep Work Timer chạm mốc 60 phút (hoặc khi người dùng đánh dấu hoàn tất block 60m), hệ thống tự động phát âm thanh chuông nhẹ (Web Audio API Synthesizer Chime độc lập không cần file ngoài).
   - Hiển thị Banner/Modal cảnh báo phong cách Apple: *"🔔 Đã hoàn thành 60 phút Deep Work! Hãy đứng dậy vận động và nghỉ ngơi 5 phút."*
3. **Đồng hồ bấm giờ Deep Work tích hợp (Timer):**
   - Cho phép bấm **Start / Pause** trên block hiện tại.
   - Khi timer chạy, số phút tự động cộng dồn vào chỉ số `Deep Work Hours` trên Header.
4. **Bộ đếm Tasks Deleted:**
   - Tự động tăng +1 mỗi khi người dùng xóa 1 card hoặc kéo card vào cột `DELETE / REPURPOSE`.
5. **Bố cục Phân Cấp Bề Mặt (Surface Hierarchy - AC-21):**
   - Tầng 1 (Timeline): Vùng quản trị thời gian với viền hairline hổ phách (amber).
   - Tầng 2 (Kanban Board): Vùng dây chuyền sản xuất nội dung với viền hairline xanh cyan (blue/cyan).
   - Tầng 3 (AI Copilot): Vùng trợ lý thông minh với viền phát sáng tím nhẹ (purple glow).

---

### Tầng 2: Kanban Board & Luật Cưỡng Chế (Enforcement Rules)
Gồm 6 cột với các quy tắc kiểm tra nghiêm ngặt:

1. **`DELETE / REPURPOSE`:**
   * Tự động hiển thị huy hiệu cảnh báo đỏ `[CTR LOW: X%]` nếu card có metrics `ctr < 2.0%`.
   * Gợi ý người dùng xóa nội dung hoặc chuyển sang tái chế làm định dạng khác (Shorts/Carousel).
2. **`IDEAS`:**
   * Modal tạo card **bắt buộc** điền trường `First Principle` (Không được để trống).
   * Phân loại platform rõ ràng: YouTube, Facebook, TikTok, X.
3. **`SINGLE FOCUS` (Luật WIP = 1):**
   * Chỉ cho phép duy nhất **1 card** tồn tại trong cột này.
   * Nếu người dùng kéo card thứ 2 vào: Hệ thống hiện thông báo cảnh báo và tự động từ chối (hoặc hoán đổi vị trí đưa card cũ về `DEEP WORK`).
4. **`DEEP WORK` (Luật WIP = 3):**
   * Giới hạn tối đa **3 cards** đang thực thi để tránh phân tán nguồn lực.
   * Khi chạm mốc 3 cards, cột chuyển sang trạng thái cảnh báo vàng và chặn nhận thêm card mới.
5. **`BLOCKED`:**
   * Khi kéo card vào cột này, một Modal bắt buộc sẽ bật lên yêu cầu điền: **`Owner`** (Ai đang chặn?) và **`ETA`** (Khi nào gỡ bỏ?). Không thể đóng modal nếu chưa nhập.
6. **`DONE + LEARNED`:**
   * Khi kéo card vào cột này, Modal bắt buộc bật lên yêu cầu nhập: **`Learned`** (Bài học thực chứng rút ra là gì?). Card chỉ được tính là hoàn thành khi đã có bài học.
7. **Hướng Dẫn Ngữ Cảnh Header Cột Kanban (Column Header Contextual Guidance — AC-19):**
   * Header của mỗi Cột Kanban trong số 6 cột tại Tầng 2 tích hợp 1 nút gợi ý Apple-style duy nhất (capsule pill `💡 Hint` / `ℹ️`).
   * Loại bỏ hoàn toàn nút Hint trên từng task item bên trong cột nhằm giữ cho các task card luôn tinh gọn, thanh lịch, tối giản chuẩn Apple HIG, không bị lặp nút gây rối mắt.
   * Khi xem/bấm mở Hint tại Header cột, hiển thị trực quan khung hướng dẫn kính mờ với 2 phần thông tin cốt lõi:
     - **Tác dụng (Purpose / Function):** Định vị ý nghĩa sống còn của cột trong pipeline (Vườn ươm nguyên lý gốc, WIP=1 chống đa nhiệm, rà soát cắt tỉa CTR < 2%, cô lập rào cản Owner+ETA, lưu trữ bài học).
     - **Cách hoạt động (How it works):** Hướng dẫn hành động và quy tắc cưỡng chế cho Creator theo thuật toán 5 bước của Elon Musk.
   * Hỗ trợ đóng mở mượt mà (toggle, nút đóng `✕`, click outside để đóng), hỗ trợ song ngữ Tiếng Việt & Tiếng Anh (`I18N`) và hiệu ứng kính mờ translucent frosted glass chuẩn Apple HIG.

---

### Tầng 3: AI Assistant (First Principles Copilot)
Tích hợp giao diện chat có sẵn 5 nút tắt (Quick Engines) gọi trực tiếp REST API (Google Gemini 1.5 Flash hoặc Llama 3):

1. **Hook Generator:** Nhận chủ đề video -> Sinh 3 Hooks phá vỡ khuôn mẫu (Pattern Interrupt) dựa trên nguyên lý tâm lý học/sự tò mò trong 3 giây đầu.
2. **Script Breakdown (Musk Style):** Nhận kịch bản thô -> Cắt tỉa 30-50% từ ngữ thừa thãi, tối ưu hóa mật độ giá trị (Value Density).
3. **Deletion Advisor:** Nhận số liệu video kém (views, CTR) -> Đưa ra lý do dứt khoát tại sao nên xóa hoặc cách tái chế nếu còn giá trị cốt lõi.
4. **Repurpose Engine:** Nhận 1 ý tưởng video dài -> Bóc tách thành 1 Carousel, 3 Shorts/Reels và 1 Thread X.
5. **Thumbnail & Title Tester:** Nhận 3 concept tiêu đề -> Đánh giá mức độ kích thích tò mò và dự đoán CTR theo thang điểm 1-10.
* **Cấu hình API Key:** Modal Settings cho phép dán API Key trực tiếp, kiểm tra kết nối (Test Connection) và lưu mã hóa nhẹ trong `localStorage`.

---

## 4. ACCEPTANCE CRITERIA (TIÊU CHÍ NGHIỆM THU)

| Mã AC | Tiêu chí nghiệm thu chi tiết | Trạng thái kiểm thử |
| :--- | :--- | :--- |
| **`AC-01`** | File duy nhất `index.html` chạy độc lập trên trình duyệt không cần máy chủ (file:/// hoặc local server). | Chờ kiểm thử |
| **`AC-02`** | Timeline Tầng 1 hiển thị các khung giờ làm việc theo ca, các block và timer bấm giờ tích lũy Deep Work. | Chờ kiểm thử |
| **`AC-03`** | Header hiển thị thời gian thực `Deep Work Hours` và `Tasks Deleted`. | Chờ kiểm thử |
| **`AC-04`** | Cột `SINGLE FOCUS` tuyệt đối chỉ chứa tối đa 1 card; chặn thả card thứ 2. | Chờ kiểm thử |
| **`AC-05`** | Cột `DEEP WORK` chỉ chứa tối đa 3 cards; vượt quá 3 cards sẽ bị từ chối kéo vào. | Chờ kiểm thử |
| **`AC-06`** | Modal thêm Card mới chặn không cho lưu nếu bỏ trống `First Principle`. | Chờ kiểm thử |
| **`AC-07`** | Kéo card vào `BLOCKED` bắt buộc mở popup yêu cầu nhập `Owner` và `ETA`. | Chờ kiểm thử |
| **`AC-08`** | Kéo card vào `DONE` bắt buộc mở popup yêu cầu nhập `Learned`. | Chờ kiểm thử |
| **`AC-09`** | Card có `CTR < 2.0%` tự động hiển thị nhãn cảnh báo đỏ và nút "Gợi ý Delete/Repurpose". | Chờ kiểm thử |
| **`AC-10`** | AI Assistant có ô cấu hình API Key (Gemini API) và 5 nút bấm Quick Engines hoạt động thật, không mock cứng. | Chờ kiểm thử |
| **`AC-11`** | Tính năng **Export JSON** xuất toàn bộ cards, time-blocks và settings về máy tính. | Chờ kiểm thử |
| **`AC-12`** | Tính năng **Import JSON** cho phép chọn file từ máy tính và khôi phục 100% dữ liệu mà không làm lỗi ứng dụng. | Chờ kiểm thử |
| **`AC-13`** | **Apple-Inspired HIG Design**: Giao diện đạt chuẩn tối giản Apple (SF Pro system font stack, hiệu ứng kính mờ `backdrop-blur`, viền hairline `border-white/[0.08]`, bo góc squircle mềm mại, Segmented Controls và micro-interaction mượt mà). | Chờ kiểm thử |
| **`AC-14`** | **Bilingual Support (Tiếng Việt & English)**: Hỗ trợ song ngữ Tiếng Việt & Tiếng Anh, chuyển đổi ngôn ngữ trong Settings Modal, cập nhật toàn bộ UI tức thì (Header, Timeline, 6 cột Kanban, Card labels, Modals, AI Quick Actions, Toasts) không cần reload trang và lưu bền vững vào `localStorage`. | Chờ kiểm thử |
| **`AC-15`** | **Dynamic Google Fonts Typography**: Tích hợp Google Fonts (`Be Vietnam Pro` cho Tiếng Việt và `Inter` cho Tiếng Anh), tự động chuyển đổi font typography theo cài đặt ngôn ngữ tức thì không cần reload trang, duy trì tính thẩm mỹ và độ sắc nét chuẩn Apple HIG. | Chờ kiểm thử |
| **`AC-16`** | **Timeline Lịch Làm Việc Thực Tế & Cảnh Báo Block 60m**: Khung giờ làm việc chuẩn 08:30 - 12:20 (sáng) và 13:30 - 16:30 (chiều). Các block 60m kèm khoảng nghỉ 5 phút giữa các ca hiển thị badge tinh tế (Break 5m). Khi đồng hồ Deep Work chạm mốc 60 phút hoặc hoàn tất block 60m, tự động phát âm thanh chuông nhẹ (Web Audio API Synthesizer) và hiển thị Banner/Modal cảnh báo Apple style. | Chờ kiểm thử |
| **`AC-17`** | **Musk First Principles Handbook (Cẩm Nang 5 Bước Thuật Toán Musk)**: Tích hợp module hướng dẫn sử dụng hệ thống chuẩn Elon Musk trong Settings Modal với 5 bước trực quan (Question, Delete, Simplify & Single Focus, Accelerate, Automate) kèm mẹo thực chiến cho Creator, hỗ trợ song ngữ Tiếng Việt và Tiếng Anh. | Chờ kiểm thử |
| **`AC-18`** | **Meta Fanpage Integration (Đặt Sân Nhanh)**: Tự động nạp thông tin Fanpage "Đặt Sân Nhanh" (Page ID: `1234257116429910`, Token mã hóa / che hiển thị an toàn `EAALZAoxk...CS3wt`), có nút bật/tắt hiển thị token, huy hiệu xanh kết nối và nút kiểm tra kết nối Meta Graph API hiển thị phản hồi tức thì. | Chờ kiểm thử |
| **`AC-19`** | **Column Header Contextual Guidance (Tập trung Hint tại Header 6 Cột Kanban, Tối giản Task Item)**: Chuyển vị trí nút Hint từ từng task item sang đặt tập trung 1 nút duy nhất tại Header của 6 Cột Kanban (DELETE / REPURPOSE, IDEAS, SINGLE FOCUS, DEEP WORK, BLOCKED, DONE); loại bỏ hoàn toàn nút `.card-hint-btn` trên từng task item giúp giao diện thoáng đãng chuẩn Apple HIG. Khi bấm nút Hint tại Header cột, hiển thị popover/khung hướng dẫn kính mờ giải thích chi tiết Tác dụng (Purpose) và Cách hoạt động (How it works). Hỗ trợ toggle, nút đóng `✕`, click outside để đóng, và hỗ trợ song ngữ đầy đủ (VI/EN). | Chờ kiểm thử |
| **`AC-20`** | **Timeline Schedule Editor Modal (Bộ Quản Lý & Chỉnh Sửa Lịch Trình Tầng 1)**: Nút `⚙️ Tùy Chỉnh Lịch / Edit Schedule` (`#btnEditTimelineSchedule`) trên thanh tiêu đề Tầng 1 mở modal Apple Sheet (`#scheduleModal`) cho phép xem, sửa tên block, giờ bắt đầu (`startTime` HH:mm), thời lượng phút (`durationMinutes`), phân loại (`deep_work`, `review`, `shallow`), thêm block mới (`+ Thêm Block Mới` / `+ Add Block`), xóa block (Delete), và nút "Khôi phục lịch chuẩn của Sếp" (`Reset to Default` 08:30 - 16:30). Lưu trạng thái bền vững vào `localStorage` (`ccc_timeblocks_v2`), re-render Timeline tức thì mà không cần reload trang và hỗ trợ song ngữ VI/EN đầy đủ. | Chờ kiểm thử |
| **`AC-21`** | **Visual Session Demarcation & Surface Hierarchy**: Tầng 1 (Timeline) phân định rõ rệt 2 vùng làm việc riêng biệt (Ca Sáng / Morning Session 08:30 - 12:20 với ánh xanh rạng đông Apple Cupertino, và Ca Chiều / Afternoon Session 13:30 - 16:30 với ánh tím hoàng hôn Lavender), ngăn cách bằng dải phân cách kính mờ Tái tạo năng lượng & Nghỉ trưa (12:20 - 13:30). Mỗi Session hiển thị header icon (`🌅` / `🌇`), tiêu đề và badge tổng thời lượng ca tự động tính toán (`4 Blocks • 3h 50m` / `3 Blocks • 3h 00m`). Bố cục 3 Tầng sở hữu đường phân tách hairline và màu nền bề mặt (surface accent) tinh tế (Tầng 1 Quản trị thời gian viền hổ phách amber, Tầng 2 Dây chuyền sản xuất nội dung viền xanh cyan, Tầng 3 AI Copilot viền phát sáng tím nhẹ). Hỗ trợ song ngữ VI/EN đầy đủ. | Chờ kiểm thử |

---

## 5. RỦI RO & GIẢI PHÁP KỸ THUẬT (RISK & MITIGATION)

1. **Rủi ro mất dữ liệu LocalStorage:**
   * *Giải pháp:* Tự động kích hoạt cơ chế backup và luôn hiển thị nút Export/Import nổi bật trên thanh Header.
2. **Lỗi XSS và vỡ DOM do dấu nháy trong tiêu đề:**
   * *Giải pháp:* Tuyệt đối không dùng `title` làm DOM ID. Bắt buộc dùng `id: crypto.randomUUID()` và escape toàn bộ nội dung text hiển thị bằng phương thức an toàn.
3. **CORS và lộ API Key:**
   * *Giải pháp:* Dùng Google Gemini REST API (`https://generativelanguage.googleapis.com/v1beta/models/...:generateContent`) hỗ trợ gọi trực tiếp từ trình duyệt; API Key được lưu trên máy cá nhân của người dùng, không bao giờ gửi ra bên ngoài.
