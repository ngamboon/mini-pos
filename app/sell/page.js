"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // สินค้าที่เลือกและจำนวนที่จะขาย
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

  // หาข้อมูลสินค้าที่เลือกอยู่ปัจจุบัน
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวมอัตโนมัติ
  const totalPrice =
    selectedProduct && quantity && !isNaN(quantity)
      ? (parseFloat(selectedProduct.price) * parseInt(quantity, 10)).toFixed(2)
      : "0.00";

  // รีเซ็ตฟอร์มหลังขายสำเร็จ
  const resetForm = () => {
    setSelectedProductId("");
    setQuantity("");
  };

  // จัดการการขายสินค้า
  const handleSell = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedProductId || !quantity || parseInt(quantity, 10) <= 0) {
      setMessage({ type: "error", text: "กรุณาเลือกสินค้าและกรอกจำนวนให้ถูกต้อง" });
      return;
    }

    const qty = parseInt(quantity, 10);

    // ดึงข้อมูลสินค้าล่าสุดอีกครั้งเพื่อตรวจสอบ stock ให้แม่นยำ
    const { data: currentProduct, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", selectedProductId)
      .single();

    if (fetchError || !currentProduct) {
      setMessage({ type: "error", text: "ไม่พบข้อมูลสินค้า กรุณาลองใหม่" });
      return;
    }

    // ตรวจสอบว่า stock เพียงพอหรือไม่
    if (currentProduct.stock < qty) {
      setMessage({
        type: "error",
        text: `สินค้าคงเหลือไม่พอ (คงเหลือ ${currentProduct.stock} ${currentProduct.unit})`,
      });
      return;
    }

    setSubmitting(true);

    const total = parseFloat(currentProduct.price) * qty;

    // บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from("sales").insert([
      {
        product_id: currentProduct.id,
        product_name: currentProduct.name,
        quantity: qty,
        total_price: total,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setSubmitting(false);
      setMessage({ type: "error", text: "บันทึกการขายไม่สำเร็จ: " + saleError.message });
      return;
    }

    // อัปเดต stock ในตาราง products ให้ลดลงตามจำนวนที่ขาย
    const newStock = currentProduct.stock - qty;
    const { error: updateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", currentProduct.id);

    setSubmitting(false);

    if (updateError) {
      setMessage({
        type: "error",
        text: "บันทึกการขายสำเร็จ แต่ปรับปรุงสต๊อกไม่สำเร็จ: " + updateError.message,
      });
      return;
    }

    setMessage({ type: "success", text: "ขายสินค้าสำเร็จ!" });
    resetForm();
    fetchProducts(); // โหลดข้อมูลสินค้าใหม่เพื่ออัปเดต stock ที่แสดงผล
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {message && (
        <div
          className="card"
          style={{
            backgroundColor: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#166534" : "#991b1b",
          }}
        >
          {message.text}
        </div>
      )}

      <div className="card">
        {loading ? (
          <p>กำลังโหลดรายการสินค้า...</p>
        ) : (
          <form onSubmit={handleSell}>
            <div className="form-row">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
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
              />
            </div>

            <p>
              <strong>ยอดรวม: ฿{totalPrice}</strong>
            </p>

            <button type="submit" disabled={submitting}>
              {submitting ? "กำลังบันทึก..." : "ขาย"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
