import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api } from "../api/client";

const CATEGORIES = [
  { name: "food", color: "#f97316" },
  { name: "transport", color: "#3b82f6" },
  { name: "utilities", color: "#8b5cf6" },
  { name: "shopping", color: "#ec4899" },
  { name: "health", color: "#22c55e" },
  { name: "entertainment", color: "#eab308" },
  { name: "other", color: "#888888" },
];

export default function AddExpenseScreen() {
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!amount || !merchant || !category || !date) {
      setError("Please fill in amount, merchant and date.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await api.addExpense({
        amount: parseFloat(amount),
        merchant,
        category,
        note,
        date,
      });
      setSuccess(`✅ ₱${amount} at ${merchant} saved!`);
      setAmount("");
      setMerchant("");
      setNote("");
      setDate(new Date().toISOString().split("T")[0]);
      setCategory("food");
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.form}>
        <Text style={styles.label}>Amount (₱)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor="#555"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Merchant / Where</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 7-Eleven, Jollibee"
          placeholderTextColor="#555"
          value={merchant}
          onChangeText={setMerchant}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.pills}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.name}
              style={[
                styles.pill,
                category === c.name && { borderColor: c.color },
              ]}
              onPress={() => setCategory(c.name)}>
              <Text style={[styles.pillText, { color: c.color }]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Any extra details"
          placeholderTextColor="#555"
          value={note}
          onChangeText={setNote}
        />

        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#555"
          value={date}
          onChangeText={setDate}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        <TouchableOpacity
          style={styles.btn}
          onPress={handleAdd}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>Add Expense</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  form: { padding: 16, gap: 8 },
  label: {
    color: "#888",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 16,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#333",
    backgroundColor: "#1a1a1a",
  },
  pillText: { fontSize: 13, fontWeight: "500" },
  error: { color: "#ef4444", fontSize: 13, marginTop: 4 },
  successText: { color: "#22c55e", fontSize: 13, marginTop: 4 },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  btnText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
