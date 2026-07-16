import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { api } from "../api/client";

export default function DebtsScreen() {
  const [tab, setTab] = useState("lent");
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadDebts();
  }, []);

  async function loadDebts() {
    try {
      const data = await api.getDebts();
      setDebts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadDebts();
  }

  async function handleAdd() {
    if (!person || !amount || !date) {
      setError("Please fill in person, amount and date.");
      return;
    }
    setAdding(true);
    setError("");
    setSuccess("");
    try {
      await api.addDebt({
        person,
        amount: parseFloat(amount),
        note,
        date,
        type: tab,
      });
      setSuccess(
        `✅ ₱${amount} ${tab === "lent" ? "lent to" : "borrowed from"} ${person} recorded!`,
      );
      setPerson("");
      setAmount("");
      setNote("");
      setDate(new Date().toISOString().split("T")[0]);
      loadDebts();
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdate(id, originalAmount) {
    Alert.prompt(
      "Update amount",
      `Remaining amount (original: ₱${originalAmount}). Enter 0 if fully paid:`,
      async (value) => {
        if (value === null || value === undefined) return;
        await api.updateDebt(id, parseFloat(value));
        loadDebts();
      },
      "plain-text",
      String(originalAmount),
    );
  }

  async function handleDelete(id) {
    Alert.alert("Delete", "Delete this debt record?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteDebt(id);
          loadDebts();
        },
      },
    ]);
  }

  const filtered = debts.filter((d) => d.type === tab);
  const unpaid = filtered.filter((d) => d.status === "unpaid");
  const paid = filtered.filter((d) => d.status === "paid");
  const totalOwed = unpaid.reduce((sum, d) => sum + parseFloat(d.amount), 0);

  const debtColor = tab === "lent" ? "#f97316" : "#ef4444";

  const renderDebt = (d) => (
    <View key={d.id} style={styles.debtItem}>
      <View style={styles.debtLeft}>
        <Text style={styles.debtPerson}>{d.person}</Text>
        <Text style={styles.debtMeta}>
          {d.date}
          {d.note ? ` · ${d.note}` : ""} · original: ₱
          {Number(d.original_amount).toLocaleString()}
        </Text>
      </View>
      <View style={styles.debtRight}>
        <Text
          style={[
            styles.debtAmount,
            { color: d.status === "paid" ? "#22c55e" : debtColor },
          ]}>
          ₱{Number(d.amount).toLocaleString()}
        </Text>
        {d.status === "unpaid" && (
          <TouchableOpacity
            onPress={() => handleUpdate(d.id, d.original_amount)}>
            <Text style={styles.editBtn}>✎</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => handleDelete(d.id)}>
          <Text style={styles.deleteBtn}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
        />
      }>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "lent" && styles.tabActive]}
          onPress={() => setTab("lent")}>
          <Text
            style={[styles.tabText, tab === "lent" && styles.tabTextActive]}>
            💰 I Lent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "owe" && styles.tabActive]}
          onPress={() => setTab("owe")}>
          <Text style={[styles.tabText, tab === "owe" && styles.tabTextActive]}>
            🧾 I Owe
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary cards */}
      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {tab === "lent" ? "Total owed to me" : "Total I owe"}
          </Text>
          <Text style={[styles.cardValue, { color: debtColor }]}>
            ₱{Number(totalOwed).toLocaleString()}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {tab === "lent" ? "People" : "Creditors"}
          </Text>
          <Text style={styles.cardValue}>{unpaid.length}</Text>
        </View>
      </View>

      {/* Add form */}
      <View style={styles.form}>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder={
              tab === "lent" ? "Who borrowed?" : "Who did you borrow from?"
            }
            placeholderTextColor="#555"
            value={person}
            onChangeText={setPerson}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Amount"
            placeholderTextColor="#555"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Note (optional)"
            placeholderTextColor="#555"
            value={note}
            onChangeText={setNote}
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#555"
            value={date}
            onChangeText={setDate}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
        <TouchableOpacity
          style={styles.btn}
          onPress={handleAdd}
          disabled={adding}>
          {adding ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Outstanding */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Outstanding</Text>
        {unpaid.length === 0 ? (
          <Text style={styles.empty}>
            {tab === "lent" ? "No outstanding debts 🎉" : "You owe nothing 🎉"}
          </Text>
        ) : (
          unpaid.map(renderDebt)
        )}
      </View>

      {/* Paid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paid / Settled</Text>
        {paid.length === 0 ? (
          <Text style={styles.empty}>None yet.</Text>
        ) : (
          paid.map(renderDebt)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  tabs: { flexDirection: "row", padding: 16, gap: 8 },
  tab: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#333",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
  },
  tabActive: { borderColor: "#fff" },
  tabText: { color: "#888", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
  cards: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  card: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 14 },
  cardLabel: {
    color: "#666",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: { color: "#fff", fontSize: 20, fontWeight: "600" },
  form: {
    margin: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  row: { flexDirection: "row", gap: 8 },
  input: {
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 14,
  },
  error: { color: "#ef4444", fontSize: 13 },
  successText: { color: "#22c55e", fontSize: 13 },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  btnText: { color: "#000", fontWeight: "700", fontSize: 15 },
  section: {
    margin: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginTop: 0,
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#888",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  debtItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  debtLeft: { flex: 1 },
  debtPerson: { color: "#fff", fontSize: 14 },
  debtMeta: { color: "#666", fontSize: 12, marginTop: 2 },
  debtRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  debtAmount: { fontSize: 14, fontWeight: "600" },
  editBtn: { color: "#888", fontSize: 16, padding: 4 },
  deleteBtn: { color: "#444", fontSize: 16, padding: 4 },
  empty: { color: "#444", textAlign: "center", paddingVertical: 16 },
});
