# 🍳 Bếp Loạn

Game nấu ăn co-op nhiều người chơi, chơi trên trình duyệt điện thoại (cầm ngang). Cả nhóm vào chung một link, mỗi người là một đầu bếp, cùng nhau thái, nấu, rửa bát và bưng món cho kịp đơn.

## Chạy server

Cần Node.js 18 trở lên.

```bash
npm install
npm start
```

Server sẽ in ra địa chỉ, ví dụ:

```
Máy này:      http://localhost:3000
Cùng wifi:    http://192.168.1.23:3000
```

### Chơi chung wifi (dễ nhất)
1. Mở link **Cùng wifi** trên điện thoại, nhập tên rồi bấm **Tạo phòng mới**.
2. Cho cả nhóm quét **mã QR** hoặc gửi link trong phòng chờ.
3. Chủ phòng 👑 bấm **VÀO BẾP!**

### Chơi qua internet (mỗi người một nơi)
Cách nhanh: mở một tunnel công khai tới máy mày.
```bash
# cài 1 lần: brew install cloudflared
cloudflared tunnel --url http://localhost:3000
```
Lệnh này sẽ đưa ra link `https://xxxx.trycloudflare.com`, gửi link đó cho cả nhóm.

Muốn có link cố định thì deploy lên bất kỳ host Node nào có hỗ trợ WebSocket (Render, Railway, Fly.io…): lệnh build là `npm install`, lệnh start là `npm start`. Server tự đọc biến môi trường `PORT`.

### Tuỳ chỉnh
| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng server |
| `ROUND` | `360` | Số giây lúc bắt đầu ván (giao món sẽ được cộng thêm) |
| `MONEY` | `0` | Tiền khởi điểm (để thử shop) |
| `SPEED` | `1` | Tua nhanh thời gian, chỉ dùng để test (vd `SPEED=5`) |

## Cách chơi
- **Joystick** (nửa trái màn hình) để đi, **✋** để cầm/đặt/ghi món/bưng/dọn, **🔪/🧽** để thái/rửa (bấm một lần là tự làm, đi chỗ khác thì dừng), **💨** để lướt, **📢** để la hét cho đồng đội, **🗺️** để xem toàn cảnh nhà hàng.
- Máy tính: `WASD` để đi · `Space` cầm/đặt · `E` thái/rửa · `Shift` lướt · `M` xem toàn cảnh · `1–8` la hét.
- Camera bám theo nhân vật của mày. Bàn đang gọi món hay chỗ đang cháy mà nằm ngoài màn hình thì có mũi tên chỉ hướng ở mép màn hình.

### Nhà hàng
Bên trái là **bếp**, bên phải là **phòng ăn** (6 bàn, mỗi bàn 2 ghế). Hai bên thông nhau qua 2 cửa. 3 ô inox ở giữa là **quầy RA MÓN 🛎️**: đặt món lên đó thì bồi bàn tự bưng ra, món nào dành cho bàn nào sẽ có nhãn ghi rõ.

1. Khách vào cửa 🚪 rồi tự ngồi vào bàn trống. Hết bàn thì khách xếp hàng ở cửa.
2. Khách xem menu 📖 một lúc rồi **giơ tay 🙋**. Ra đứng cạnh bàn bấm **📝 Ghi món** thì đơn mới hiện ở thanh trên (có ghi số bàn).
3. Nấu xong bày lên đĩa, **bưng ra đúng bàn** bấm **🍽️ Bưng**. Bàn 2 người gọi 2 món, phải bưng đủ.
4. Khách ăn 😋 xong thì trả tiền 💰 (bưng nhanh có thêm tip) và cộng thêm giờ, rồi đi về.
5. Khách để lại **đĩa bẩn** trên bàn. Tay không bấm **🧹 Dọn**, rồi mang vào bồn rửa. Bàn còn bẩn thì khách mới không ngồi được!

Chờ lâu là khách **càm ràm rồi chửi** (đọc bằng giọng tiếng Việt của điện thoại, máy nào không có thì phát tiếng lầm bầm; tắt được trong ❓). Hết kiên nhẫn thì khách bỏ về, bị −10 uy tín.

| Món | Công thức |
|---|---|
| 🥗 Salad rau | 🥬 thái + 🍅 thái → đĩa |
| 🍲 Súp cà chua | 3× 🍅 thái → nồi → chín → múc ra đĩa |
| 🥣 Súp hành | 3× 🧅 thái → nồi → chín → múc ra đĩa |
| 🥖 Bánh mì thịt | 🍞 thái + 🥩 thái → chảo + 🥬 thái → đĩa |

- Để nồi/chảo quá lâu là **khét** ⚫, phải bấm ✋ tay không để đổ đi. Để khét lâu quá thì lò bắt lửa luôn.
- Lúc đầu cả nhà hàng chỉ có **5 cái đĩa** (mua thêm được trong 🛒).
- Ván bắt đầu với **6 phút**. Mỗi món giao xong được cộng thêm 15–22 giây.
- Thua khi **hết giờ** hoặc **uy tín ❤️ về 0**. Có chuột/lửa/sàn bẩn thì uy tín tụt dần, khách trả tiền thì hồi lại.
- Cứ mỗi **3 phút** lên một cấp: khách tới dày hơn, nóng tính hơn, sự kiện nhiều hơn.

### Sự kiện (bắt đầu từ phút thứ 2, khó dần theo cấp)
| Sự kiện | Mô tả | Cách xử lý |
|---|---|---|
| 🐀 Chuột | Ăn vụng đồ trên bàn bếp, ỉa bậy 💩 ra sàn | Tay không đứng gần bấm 🔨 Đập · 🐱 Nuôi mèo · 🧪 Thuốc diệt chuột |
| 👑 Khách VIP | Trả tiền x3, cộng gấp đôi giờ, nhưng rất nóng tính | Ưu tiên phục vụ trước |
| 🔥 Giờ cao điểm | Khách kéo tới gấp đôi, tiền x1.5 | Chạy cho nhanh |
| 🧯 Cháy lò | Lửa cháy rồi lan sang các ô bên cạnh | Cầm 🧯 bình cứu hỏa bấm Xịt · 🚿 Vòi phun nước |
| 🔌 Cúp điện | Đèn tối, bếp ngừng nấu | 🔋 Máy phát điện |
| 🕵️ Thanh tra | Có 35 giây để dọn: chuột, lửa, sàn bẩn, bàn bẩn, đĩa bẩn | Sạch thì được thưởng, bẩn thì bị phạt · 📋 Giấy chứng nhận ATTP |

Sàn bẩn 💩 làm chậm bước chân. Cầm 🧹 cây lau nhà (có sẵn 1 cây) đi qua là sạch.

### Cửa hàng 🛒 (tiền chung cả đội, game vẫn chạy trong lúc mua)
- **Thuê nhân viên** (cứ mỗi phút trả lương một lần, hết tiền là họ nghỉ):
  - 🤵 **Bồi bàn** (70💰): lấy món ở quầy ra món bưng tới đúng bàn → ghi món cho bàn giơ tay (40% làm khách vui, cộng thêm 25% thời gian chờ) → dọn đĩa bẩn về bồn rửa. Rảnh thì đứng chờ cạnh quầy ra món.
  - 📝 **NV tiếp khách** (60💰): chuyên ghi món, khéo ăn nói hơn: 70% làm khách vui.
  - 🧽 Rửa bát · 🔪 Phụ bếp thái · 🧺 Sơ chế (bày sẵn nguyên liệu đã thái lên 3 bàn trên cùng) · 🐱 Mèo bắt chuột
- **Đồ dùng**: 🧯 Bình cứu hỏa · 🧪 Thuốc chuột · 🧹 Cây lau · 🍽️ Thêm đĩa · ⏳ +30 giây · 📋 Giấy ATTP.
- **Nâng cấp vĩnh viễn**: 🔋 Máy phát điện · 👟 Giày chạy nhanh · ♨️ Bếp ga xịn · 🎵 Nhạc nhẹ (khách kiên nhẫn hơn) · 🚿 Vòi phun nước.

**Vai trò** (ai cũng làm được mọi việc, vai chỉ cho thêm buff): 🔪 Thợ thái thái nhanh x2 · 🍳 Bếp chính: nồi do mình bỏ đủ đồ sẽ chín nhanh x1.5 · 🧽 Rửa bát rửa nhanh x2 · 🏃 Bưng bê chạy nhanh hơn 20%, và đội có Bưng bê thì khách kiên nhẫn hơn 10%.

## Cấu trúc
- `server.js`: HTTP tĩnh + WebSocket, quản lý phòng, chạy toàn bộ luật game (20 tick/giây).
- `public/index.html`, `public/style.css`: giao diện, HUD, nút cảm ứng.
- `public/game.js`: dựng nhà hàng 3D bằng Three.js, nhân vật, khách, camera bám theo người chơi, joystick, âm thanh (WebAudio + giọng đọc).

Bản đồ nhà hàng nằm trong mảng `MAP` ở `server.js`. Sửa các ký tự trong đó là có bếp mới (chú thích ký hiệu ghi ngay bên trên).

> Three.js và thư viện QR được tải từ CDN (jsdelivr), nên điện thoại cần có internet.
