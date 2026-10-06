# Biên tập Map Online

Trình biên tập bản đồ Việt Nam chạy trực tiếp trên trình duyệt, tối ưu cho GitHub Pages. Dự án dùng dữ liệu 34 tỉnh/thành và kế thừa tinh thần layout từ bản GEE VN34: tiêu đề, chú giải, hướng Bắc, tỷ lệ xích, nhãn Biển Đông/Hoàng Sa/Trường Sa và xuất bản đồ.

## Chức năng

- Tạo bản đồ **toàn quốc**, **6 vùng kinh tế - xã hội**, hoặc tự chọn nhiều tỉnh để ghép thành **khu vực / địa bàn** và đặt tên tùy ý.
- Bảng **256 màu** + color picker; tô màu theo nhóm hoặc từng tỉnh.
- Nhấp tỉnh trên bản đồ để sửa nhãn riêng; sửa tiêu đề, phụ đề, nguồn, tác giả và các nhãn Biển Đông / Hoàng Sa / Trường Sa.
- Khung xuất mặc định luôn bao quát đất liền Việt Nam và phần Biển Đông có Hoàng Sa, Trường Sa.
- WGS84 EPSG:4326; VN-2000 địa lý EPSG:4756; VN-2000 / UTM 48N EPSG:3405; VN-2000 / UTM 49N EPSG:3406.
- Lưới kinh vĩ tuyến hoặc lưới mét VN-2000, thước tỷ lệ, hướng Bắc, chú giải.
- Nền trắng để xuất bản, nền địa lý sáng hoặc OpenStreetMap.
- Xuất PNG, PDF A4 ngang, GeoJSON đã gắn nhóm/màu/nhãn; lưu/mở dự án JSON.
- Nhập GeoJSON riêng nếu cần biên tập dữ liệu độ phân giải cao.

## Dữ liệu

`data/provinces.json` là dữ liệu 34 tỉnh/thành đã được tối ưu hóa để tải nhanh trên web. Cấu trúc và phạm vi đã được đối chiếu với GeoJSON 34 tỉnh/thành do tác giả cung cấp; khi cần độ chính xác hình học cao, dùng nút **Nhập GeoJSON riêng** trong giao diện.

Dữ liệu web tối ưu được sao chép từ `lamngockhuong/vietnam-3d-map` (MIT) vì có cùng hệ thuộc tính/phạm vi 34 tỉnh và đã được rút gọn sẵn cho trình duyệt. Thông báo bản quyền bên thứ ba nằm trong `THIRD_PARTY_NOTICES.md`.

## Hệ tọa độ VN-2000

- EPSG:4756: VN-2000 geographic CRS.
- EPSG:3405: VN-2000 / UTM zone 48N, dùng cho phần lãnh thổ onshore phía tây 108°E.
- EPSG:3406: VN-2000 / UTM zone 49N, dùng cho phần lãnh thổ onshore phía đông 108°E.

Tham khảo định nghĩa EPSG: https://epsg.io/4756, https://epsg.io/3405, https://epsg.io/3406.

## Chạy local

Vì ứng dụng `fetch()` file GeoJSON, hãy chạy qua web server thay vì mở `file://`:

```bash
python -m http.server 8080
```

Sau đó mở `http://localhost:8080`.

## GitHub Pages

Workflow `.github/workflows/pages.yml` sẽ triển khai static site khi push lên `main`. URL dự kiến:

`https://xulytiengviet.github.io/bientapmap/`

## Giấy phép

MIT. Biên tập và phát triển: Long Ngo.
