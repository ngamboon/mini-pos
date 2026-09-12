"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ProductsPage() {
  // รายการสินค้าทั้งหมด
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ฟอร์มเพิ่มสินค้าใหม่
  const [form, setForm] = useState({
    sku: "",
    name: "",
    price: "",
    stock: "",
    unit: "",
  });

  // เก็บ id ของแถวที่กำลังแก้ไข และข้อมูลชั่วคราวระหว่างแก้ไข
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // โหลดสินค้าทั้งหมดจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("โหลดรายการสินค้าไม่สำเร็จ: " + error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // อัปเดตค่าฟอร์มเพิ่มสินค้าใหม่
  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // เพิ่มสินค้าใหม่ลงตาราง products
  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!form.sku || !form.name || !form.price || !form.stock || !form.unit) {
      alert("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    const { error } = await supabase.from("products").insert([
      {
        sku: form.sku,
        name: form.name,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        unit: form.unit,
      },
    ]);

    if (error) {
      alert("เพิ่มสินค้าไม่สำเร็จ: " + error.message);
      return;
    }

    // เคลียร์ฟอร์มและโหลดข้อมูลใหม่
    setForm({ sku: "", name: "", price: "", stock: "", unit: "" });
    fetchProducts();
  };

  // ลบสินค้า
  const handleDelete = async (id) => {
    const confirmDelete = confirm("ยืนยันการลบสินค้านี้?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      alert("ลบสินค้าไม่สำเร็จ: " + error.message);
      return;
    }
    fetchProducts();
  };

  // เริ่มแก้ไขแบบ inline: เก็บค่าปัจจุบันของแถวนั้นไว้ใน editForm
  const startEdit = (product) => {
    setEditingId(product.id);
    setEditForm({
      sku: product.sku,
      name: product.name,
      price: product.price,
      stock: product.stock,
      unit: product.unit,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleEditFormChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  // บันทึกการแก้ไขสินค้า
  const handleSaveEdit = async (id) => {
    const { error } = await supabase
      .from("products")
      .update({
        sku: editForm.sku,
        name: editForm.name,
        price: parseFloat(editForm.price),
        stock: parseInt(editForm.stock, 10),
        unit: editForm.unit,
      })
      .eq("id", id);

    if (error) {
      alert("แก้ไขสินค้าไม่สำเร็จ: " + error.message);
      return;
    }

    setEditingId(null);
    setEditForm({});
    fetchProducts();
  };

  return (
    <div>
      <h1>รายการสินค้า</h1>

      {/* ฟอร์มเพิ่มสินค้าใหม่ */}
      <div className="card">
        <h2>เพิ่มสินค้าใหม่</h2>
        <form onSubmit={handleAddProduct}>
          <div className="form-row">
            <input
              type="text"
              name="sku"
              placeholder="SKU"
              value={form.sku}
              onChange={handleFormChange}
            />
            <input
              type="text"
              name="name"
              placeholder="ชื่อสินค้า"
              value={form.name}
              onChange={handleFormChange}
            />
            <input
              type="number"
              name="price"
              placeholder="ราคา"
              value={form.price}
              onChange={handleFormChange}
              step="0.01"
              min="0"
            />
            <input
              type="number"
              name="stock"
              placeholder="คงเหลือ"
              value={form.stock}
              onChange={handleFormChange}
              min="0"
            />
            <input
              type="text"
              name="unit"
              placeholder="หน่วย"
              value={form.unit}
              onChange={handleFormChange}
            />
            <button type="submit">เพิ่มสินค้า</button>
          </div>
        </form>
      </div>

      {/* ตารางรายการสินค้า */}
      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ราคา</th>
              <th>คงเหลือ</th>
              <th>หน่วย</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan="6">ยังไม่มีสินค้า</td>
              </tr>
            )}
            {products.map((product) => (
              <tr key={product.id}>
                {editingId === product.id ? (
                  // โหมดแก้ไข inline
                  <>
                    <td>
                      <input
                        type="text"
                        name="sku"
                        value={editForm.sku}
                        onChange={handleEditFormChange}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="name"
                        value={editForm.name}
                        onChange={handleEditFormChange}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="price"
                        value={editForm.price}
                        onChange={handleEditFormChange}
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="stock"
                        value={editForm.stock}
                        onChange={handleEditFormChange}
                        min="0"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        name="unit"
                        value={editForm.unit}
                        onChange={handleEditFormChange}
                      />
                    </td>
                    <td>
                      <button onClick={() => handleSaveEdit(product.id)}>
                        บันทึก
                      </button>{" "}
                      <button onClick={cancelEdit}>ยกเลิก</button>
                    </td>
                  </>
                ) : (
                  // โหมดแสดงผลปกติ
                  <>
                    <td>{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{product.price}</td>
                    <td>{product.stock}</td>
                    <td>{product.unit}</td>
                    <td>
                      <button onClick={() => startEdit(product)}>แก้ไข</button>{" "}
                      <button onClick={() => handleDelete(product.id)}>
                        ลบ
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
