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
3. Chủ phòng 👑 bấm **VÀO BẾP!** (hoặc **🎯 Thử thách hôm nay**).

### Lưu game và vào lại
- Chủ phòng bấm **🚪 → 💾 Lưu & thoát** (trong lúc chơi, ở màn hết ngày hay ở phòng chờ) thì quán được lưu lại và **cả phòng thoát theo**.
- File lưu nằm ngay trên trình duyệt của chủ phòng (localStorage, không cần database), giữ tối đa 5 quán. Đang chơi thì cứ 20 giây tự lưu một lần, nên chủ phòng có rớt mạng cũng chỉ mất vài giây.
- Lần sau chủ phòng mở game, ở màn hình chính có mục **📂 Quán đã lưu**: bấm ▶ là mở lại đúng mã phòng cũ (nếu mã đó đang bị phòng khác dùng thì được cấp mã mới), rồi gửi mã/link cho cả nhóm vào lại. Lưu giữa ngày thì chơi tiếp đúng chỗ đang dở.
- Chỉ chủ phòng mới lưu và mở lại được quán; người khác chỉ vào phòng bằng mã. Người khác rời phòng thì cả nhóm vẫn chơi tiếp.

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
| `DAY` | `600` | Độ dài một ngày, tính bằng giây (10 phút) |
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
4. Khách ăn 😋 xong thì trả tiền 💰 (bưng nhanh có thêm tip), rồi đi về.
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
- Có chuột/lửa/sàn bẩn thì uy tín ❤️ tụt dần, khách trả tiền thì hồi lại.

### Chơi theo ngày
Mỗi **ngày dài 10 phút**. Hết ngày mà doanh thu đạt **chỉ tiêu 🎯** thì sang ngày mới: tiền, đĩa, nhân viên, nâng cấp, bình cứu hỏa… giữ nguyên, bếp được dọn sạch, uy tín về lại 100. Trượt chỉ tiêu hoặc uy tín về 0 thì làm lại ngày đó (tiền về như đầu ngày). 40 giây cuối ngày quán ngừng nhận khách và không có sự kiện mới.

| Ngày | Khách tối đa cùng lúc | Khách mới tới mỗi | Lượt khách ≈ | Kiên nhẫn | Thực đơn | Sự kiện mới | Chỉ tiêu (1/2/3 ⭐) |
|---|---|---|---|---|---|---|---|
| 1 | 2 | ~38s | 12–15 | 115% | 🥗 🍲 | Không có sự kiện | 120 / 204 / 300 |
| 2 | 3 | ~34s | 15–17 | 110% | + 🥣 | 🐀 Chuột | 210 / 357 / 525 |
| 3 | 5 | ~30s | 17–20 | 105% | + 🥖 | 🔥 Giờ cao điểm · 👑 VIP | 300 / 510 / 750 |
| 4 | 6 | ~27s | 19–22 | 100% | đủ món | 🧯 Cháy lò · 🎂 Tiệc sinh nhật | 390 / 663 / 975 |
| 5 | 8 | ~24s | 22–25 | 95% | đủ món | 🔌 Cúp điện · 📦 Hết hàng | 480 / 816 / 1200 |
| 6 | 10 | ~22s | 24–27 | 90% | đủ món | 🕵️ Thanh tra · 🛵 Shipper | 570 / 969 / 1425 |
| 7 | 12 | ~20s | 27–30 | 85% | đủ món | 🗣️ Bà Tám · 🥵 Nắng nóng | 660 / 1122 / 1650 |
| 8+ | +1 mỗi ngày (tối đa 16) | nhanh dần (tối thiểu 14s) | 30+ | −3% mỗi ngày (tối thiểu 65%) | đủ món | sự kiện dày hơn, mạnh hơn | +90 mỗi ngày |

Đông người chơi thì khách tới nhanh hơn một chút (mỗi người thêm khoảng 7%). Sự kiện mới của ngày nào chắc chắn xuất hiện ít nhất một lần trong ngày đó. Toàn bộ thông số nằm trong `DAY_PLAN` ở `server.js`.

### 🎯 Thử thách hôm nay
Một ván 10 phút với một luật đặc biệt đổi theo ngày (giờ Việt Nam), độ khó cỡ ngày 5 và có đủ mọi sự kiện: 🥗 Ngày ăn chay · 🐀 Ổ chuột · 🔌 Điện chập chờn · 🍽️ Thiếu đĩa · ⚡ Khách vội · 👥 Quán đông nghịt · 💸 Cửa hàng đóng cửa · 👑 Ngày của VIP · 🔥 Bếp nóng. Kỷ lục được lưu trên từng máy. Thử thách không ảnh hưởng tới quán đang chơi theo ngày.

### Danh hiệu cuối ngày
Hết ngày, mỗi người nhận một danh hiệu tính từ những gì đã làm: ⚫ Thánh làm khét · 🤡 Thánh bưng nhầm · 🐀 Sát thủ chuột · 🧯 Lính cứu hỏa · 🍽️ Thần bưng bê · 🔪 Sát thủ thớt · 🧽 Vua rửa bát · 📝 Thư ký quốc dân · 🗑️ Chúa tể thùng rác · 🧹 Lao công gương mẫu · 📢 Cái loa phường · 💸 Đại gia chịu chi · 🏃 Vận động viên marathon · 😴 Kẻ đứng nhìn (từ 3 người, ai làm ít hẳn). Người làm nhiều nhất được 👑 MVP.

### Sự kiện
| Sự kiện | Mô tả | Cách xử lý |
|---|---|---|
| 🐀 Chuột | Ăn vụng đồ trên bàn bếp, ỉa bậy 💩 ra sàn | Tay không đứng gần bấm 🔨 Đập · 🐱 Nuôi mèo · 🧪 Thuốc diệt chuột |
| 👑 Khách VIP | Trả tiền x3 nhưng rất nóng tính | Ưu tiên phục vụ trước |
| 🎂 Tiệc sinh nhật | Bàn 2 người, trả tiền x2, chịu chờ lâu hơn chút | Bưng đủ 2 món |
| 📦 Hết hàng | Một thùng nguyên liệu trống trơn 35 giây | Chờ, hoặc 📞 Gọi giao hàng gấp |
| 🛵 Shipper | Đứng ở cửa chờ đơn mang đi, không chờ lâu | Cầm món tới gần bấm 🛵 Giao (đĩa sạch vẫn ở trên tay) |
| 🗣️ Bà Tám | Ngồi một bàn, ai đi ngang là bị níu lại nói chuyện 2–3 giây | Đi vòng tránh bàn bà |
| 🥵 Nắng nóng | 45 giây khách mất kiên nhẫn nhanh gấp 1.4 lần | 🧊 Trà đá mời khách |
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
- **Đồ dùng**: 🧯 Bình cứu hỏa · 🧪 Thuốc chuột · 🧹 Cây lau · 🍽️ Thêm đĩa · 🧊 Trà đá mời khách · 📞 Gọi giao hàng gấp · 📋 Giấy ATTP.
- **Nâng cấp vĩnh viễn**: 🔋 Máy phát điện · 👟 Giày chạy nhanh · ♨️ Bếp ga xịn · 🎵 Nhạc nhẹ (khách kiên nhẫn hơn) · 🚿 Vòi phun nước.

**Vai trò** (ai cũng làm được mọi việc, vai chỉ cho thêm buff): 🔪 Thợ thái thái nhanh x2 · 🍳 Bếp chính: nồi do mình bỏ đủ đồ sẽ chín nhanh x1.5 · 🧽 Rửa bát rửa nhanh x2 · 🏃 Bưng bê chạy nhanh hơn 20%, và đội có Bưng bê thì khách kiên nhẫn hơn 10%.

## Cấu trúc
- `server.js`: HTTP tĩnh + WebSocket, quản lý phòng, chạy toàn bộ luật game (20 tick/giây).
- `public/index.html`, `public/style.css`: giao diện, HUD, nút cảm ứng.
- `public/game.js`: dựng nhà hàng 3D bằng Three.js, nhân vật, khách, camera bám theo người chơi, joystick, âm thanh (WebAudio + giọng đọc).

Bản đồ nhà hàng nằm trong mảng `MAP` ở `server.js`. Sửa các ký tự trong đó là có bếp mới (chú thích ký hiệu ghi ngay bên trên).

> Three.js và thư viện QR được tải từ CDN (jsdelivr), nên điện thoại cần có internet.
