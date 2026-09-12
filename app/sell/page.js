"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ตะกร้าสินค้าที่จะขาย: [{ product_id, name, price, unit, stock, quantity }]
  const [cart, setCart] = useState([]);

  // ฟอร์มเลือกสินค้าเพื่อเพิ่มลงตะกร้า
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: string }

  // โหลดรายการสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setMessage({ type: "error", text: "โหลดรายการสินค้าไม่สำเร็จ: " + error.message });
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // ยอดรวมทั้งบิล (รวมทุกรายการในตะกร้า)
  const grandTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // เพิ่มสินค้าลงตะกร้า
  const handleAddToCart = () => {
    setMessage(null);

    if (!selectedProductId || !quantity || parseInt(quantity, 10) <= 0) {
      setMessage({ type: "error", text: "กรุณาเลือกสินค้าและกรอกจำนวนให้ถูกต้อง" });
      return;
    }

    const qty = parseInt(quantity, 10);

    // จำนวนที่เพิ่มไปแล้วในตะกร้า (กรณีเพิ่มสินค้าเดิมซ้ำ)
    const alreadyInCart = cart
      .filter((item) => item.product_id === selectedProductId)
      .reduce((sum, item) => sum + item.quantity, 0);

    if (alreadyInCart + qty > selectedProduct.stock) {
      setMessage({
        type: "error",
        text: `สินค้าคงเหลือไม่พอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit}, ในตะกร้ามีแล้ว ${alreadyInCart})`,
      });
      return;
    }

    // ถ้ามีสินค้านี้ในตะกร้าอยู่แล้ว ให้รวมจำนวนเข้าด้วยกัน
    const existingIndex = cart.findIndex(
      (item) => item.product_id === selectedProductId
    );

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += qty;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          product_id: selectedProduct.id,
          name: selectedProduct.name,
          price: parseFloat(selectedProduct.price),
          unit: selectedProduct.unit,
          stock: selectedProduct.stock,
          quantity: qty,
        },
      ]);
    }

    setSelectedProductId("");
    setQuantity("");
  };

  // ลบรายการออกจากตะกร้า
  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  // แก้ไขจำนวนของรายการในตะกร้าโดยตรง
  const handleChangeCartQty = (productId, newQty) => {
    setCart(
      cart.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: Math.max(1, parseInt(newQty, 10) || 1) }
          : item
      )
    );
  };

  const resetAll = () => {
    setCart([]);
    setSelectedProductId("");
    setQuantity("");
  };

  // ยืนยันการขายทั้งบิล (หลายรายการ)
  const handleConfirmSale = async () => {
    setMessage(null);

    if (cart.length === 0) {
      setMessage({ type: "error", text: "ยังไม่มีสินค้าในตะกร้า" });
      return;
    }

    setSubmitting(true);

    // ตรวจสอบ stock ล่าสุดของทุกสินค้าในตะกร้าก่อนบันทึกจริง
    const productIds = cart.map((item) => item.product_id);
    const { data: currentProducts, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);

    if (fetchError || !currentProducts) {
      setSubmitting(false);
      setMessage({ type: "error", text: "ไม่สามารถตรวจสอบสต๊อกสินค้าได้ กรุณาลองใหม่" });
      return;
    }

    // เช็คว่าทุกรายการมี stock พอหรือไม่
    for (const item of cart) {
      const current = currentProducts.find((p) => p.id === item.product_id);
      if (!current || current.stock < item.quantity) {
        setSubmitting(false);
        setMessage({
          type: "error",
          text: `"${item.name}" คงเหลือไม่พอ (คงเหลือ ${current ? current.stock : 0})`,
        });
        return;
      }
    }

    const soldAt = new Date().toISOString();

    // บันทึกลงตาราง sales ทีละรายการ (1 แถวต่อ 1 สินค้า)
    const salesRows = cart.map((item) => ({
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: soldAt,
    }));

    const { error: saleError } = await supabase.from("sales").insert(salesRows);

    if (saleError) {
      setSubmitting(false);
      setMessage({ type: "error", text: "บันทึกการขายไม่สำเร็จ: " + saleError.message });
      return;
    }

    // อัปเดต stock ของสินค้าทุกชิ้นในตะกร้า
    for (const item of cart) {
      const current = currentProducts.find((p) => p.id === item.product_id);
      const newStock = current.stock - item.quantity;
      const { error: updateError } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", item.product_id);

      if (updateError) {
        // แจ้งเตือนแต่ไม่หยุดกลางทาง เพื่อไม่ให้ค้างสถานะครึ่งๆ กลางๆ
        console.error(`อัปเดตสต๊อก ${item.name} ไม่สำเร็จ:`, updateError.message);
      }
    }

    setSubmitting(false);
    setMessage({ type: "success", text: "บันทึกการขายสำเร็จ!" });
    resetAll();
    fetchProducts();
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {/* สรุปยอดรวมทั้งบิล - ตัวใหญ่ อยู่บนสุด เห็นชัดทั้งฝั่งผู้ขายและลูกค้า */}
      <div
        className="card"
        style={{
          textAlign: "center",
          padding: "24px 16px",
          backgroundColor: "#1f2937",
          color: "#fff",
        }}
      >
        <div style={{ fontSize: "16px", opacity: 0.8, marginBottom: "6px" }}>
          ยอดรวมทั้งหมด
        </div>
        <div style={{ fontSize: "48px", fontWeight: "800", lineHeight: 1 }}>
          ฿{grandTotal.toFixed(2)}
        </div>
        <div style={{ fontSize: "14px", opacity: 0.7, marginTop: "6px" }}>
          {cart.length} รายการสินค้า
        </div>
      </div>

      {message && (
        <div
          className="card"
          style={{
            backgroundColor: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#166534" : "#991b1b",
            fontSize: "15px",
          }}
        >
          {message.text}
        </div>
      )}

      {/* ฟอร์มเลือกสินค้าเพื่อเพิ่มลงตะกร้า */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>เพิ่มสินค้า</h2>
        {loading ? (
          <p>กำลังโหลดรายการสินค้า...</p>
        ) : (
          <div className="form-row">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              style={{ flex: 2, minWidth: "200px" }}
            >
              <option value="">-- เลือกสินค้า --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (฿{p.price} / {p.unit}) — คงเหลือ {p.stock}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="จำนวน"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{ width: "100px" }}
            />

            <button type="button" onClick={handleAddToCart}>
              + เพิ่มลงตะกร้า
            </button>
          </div>
        )}
      </div>

      {/* รายการในตะกร้า - ตัวใหญ่ อ่านง่าย เหมาะกับหน้าจอที่ทั้งผู้ขายและลูกค้าดูร่วมกัน */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>รายการที่จะขาย</h2>
        {cart.length === 0 ? (
          <p style={{ color: "#6b7280" }}>ยังไม่มีสินค้าในตะกร้า</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>ราคา/หน่วย</th>
                <th>จำนวน</th>
                <th>รวม</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.product_id}>
                  <td style={{ fontSize: "16px", fontWeight: "600" }}>
                    {item.name}
                  </td>
                  <td>
                    ฿{item.price} / {item.unit}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleChangeCartQty(item.product_id, e.target.value)
                      }
                      style={{ width: "70px" }}
                    />
                  </td>
                  <td style={{ fontSize: "18px", fontWeight: "700" }}>
                    ฿{(item.price * item.quantity).toFixed(2)}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.product_id)}
                      style={{ backgroundColor: "#dc2626" }}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {cart.length > 0 && (
          <div style={{ marginTop: "20px", textAlign: "right" }}>
            <button
              type="button"
              onClick={handleConfirmSale}
              disabled={submitting}
              style={{
                fontSize: "18px",
                padding: "14px 32px",
                backgroundColor: "#16a34a",
              }}
            >
              {submitting ? "กำลังบันทึก..." : "✔ ยืนยันการขาย"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
