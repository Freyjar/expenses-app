import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { api } from "../api/client";

const CATEGORIES = [
  { name: "food", icon: "🍔", color: "#f97316" },
  { name: "transport", icon: "🚗", color: "#3b82f6" },
  { name: "utilities", icon: "💡", color: "#8b5cf6" },
  { name: "shopping", icon: "🛍️", color: "#ec4899" },
  { name: "health", icon: "💊", color: "#22c55e" },
  { name: "entertainment", icon: "🎮", color: "#eab308" },
  { name: "other", icon: "📦", color: "#888888" },
];

const STEPS = ["category", "amount", "merchant", "details"];

export default function AddExpenseScreen() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(null);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [recentMerchants, setRecentMerchants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const amountRef = useRef(null);
  const merchantRef = useRef(null);

  useEffect(() => {
    loadRecentMerchants();
  }, []);

  useEffect(() => {
    if (step === 1) setTimeout(() => amountRef.current?.focus(), 100);
    if (step === 2) setTimeout(() => merchantRef.current?.focus(), 100);
  }, [step]);

  async function loadRecentMerchants() {
    try {
      const data = await api.getRecentMerchants();
      setRecentMerchants(data);
    } catch {}
  }

  function selectCategory(cat) {
    setCategory(cat);
    setStep(1);
  }

  function selectMerchant(name) {
    setMerchant(name);
    setStep(3);
  }

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  function reset() {
    setStep(0);
    setCategory(null);
    setAmount("");
    setMerchant("");
    setNote("");
    setDate(new Date().toISOString().split("T")[0]);
    setSuccess("");
    setError("");
  }

  async function handleSubmit() {
    if (!amount || !merchant || !category) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.addExpense({
        amount: parseFloat(amount),
        merchant,
        category: category.name,
        note,
        date,
      });
      setSuccess(`✅ ₱${amount} at ${merchant} saved!`);
      loadRecentMerchants();
      setTimeout(() => reset(), 1500);
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const stepLabels = ["Category", "Amount", "Merchant", "Details"];

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Progress bar */}
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                i <= step && { backgroundColor: category?.color || "#fff" },
              ]}
            />
            <Text
              style={[
                styles.progressLabel,
                i === step && styles.progressLabelActive,
              ]}>
              {stepLabels[i]}
            </Text>
          </View>
        ))}
      </View>

      {/* Back button */}
      {step > 0 && (
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      )}

      {/* Step 0: Category */}
      {step === 0 && (
        <View style={styles.section}>
          <Text style={styles.stepTitle}>What category?</Text>
          <View style={styles.grid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                style={[styles.categoryCard, { borderColor: cat.color + "44" }]}
                onPress={() => selectCategory(cat)}>
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={[styles.categoryName, { color: cat.color }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Step 1: Amount */}
      {step === 1 && (
        <View style={styles.section}>
          <Text style={styles.stepTitle}>How much?</Text>
          <View
            style={[styles.amountBox, { borderColor: category?.color + "66" }]}>
            <Text style={[styles.currencySign, { color: category?.color }]}>
              ₱
            </Text>
            <TextInput
              ref={amountRef}
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#333"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              onSubmitEditing={() => amount && setStep(2)}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.nextBtn,
              { backgroundColor: category?.color || "#fff" },
            ]}
            onPress={() => amount && setStep(2)}>
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 2: Merchant */}
      {step === 2 && (
        <View style={styles.section}>
          <Text style={styles.stepTitle}>Where / who?</Text>

          {recentMerchants.length > 0 && (
            <>
              <Text style={styles.subLabel}>Recent</Text>
              <View style={styles.grid}>
                {recentMerchants.map((m) => (
                  <TouchableOpacity
                    key={m.merchant}
                    style={styles.merchantCard}
                    onPress={() => selectMerchant(m.merchant)}>
                    <Text style={styles.merchantIcon}>
                      {CATEGORIES.find((c) => c.name === m.category)?.icon ||
                        "📦"}
                    </Text>
                    <Text style={styles.merchantName} numberOfLines={1}>
                      {m.merchant}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.subLabel}>Or type new</Text>
            </>
          )}

          <TextInput
            ref={merchantRef}
            style={styles.input}
            placeholder="e.g. 7-Eleven, Jollibee"
            placeholderTextColor="#555"
            value={merchant}
            onChangeText={setMerchant}
            onSubmitEditing={() => merchant && setStep(3)}
          />
          <TouchableOpacity
            style={[
              styles.nextBtn,
              { backgroundColor: category?.color || "#fff" },
            ]}
            onPress={() => merchant && setStep(3)}>
            <Text style={styles.nextBtnText}>Next →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <View style={styles.section}>
          <Text style={styles.stepTitle}>Any details?</Text>

          {/* Summary */}
          <View
            style={[
              styles.summaryBox,
              { borderColor: category?.color + "44" },
            ]}>
            <Text style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Category </Text>
              <Text style={[styles.summaryValue, { color: category?.color }]}>
                {category?.icon} {category?.name}
              </Text>
            </Text>
            <Text style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount </Text>
              <Text style={styles.summaryValue}>₱{amount}</Text>
            </Text>
            <Text style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Merchant </Text>
              <Text style={styles.summaryValue}>{merchant}</Text>
            </Text>
          </View>

          <Text style={styles.subLabel}>Note (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Any extra details"
            placeholderTextColor="#555"
            value={note}
            onChangeText={setNote}
          />

          <Text style={styles.subLabel}>Date</Text>
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
            style={[
              styles.nextBtn,
              { backgroundColor: category?.color || "#fff" },
            ]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.nextBtnText}>Save expense ✓</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    paddingBottom: 8,
  },
  progressItem: { alignItems: "center", gap: 4 },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#333",
  },
  progressLabel: { fontSize: 10, color: "#555" },
  progressLabelActive: { color: "#fff" },
  backBtn: { paddingHorizontal: 16, paddingBottom: 4 },
  backBtnText: { color: "#888", fontSize: 14 },
  section: { padding: 16, gap: 12 },
  stepTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 11,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Category grid
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryCard: {
    width: "47%",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  categoryIcon: { fontSize: 28 },
  categoryName: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "capitalize",
  },

  // Amount
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 16,
    gap: 8,
  },
  currencySign: { fontSize: 32, fontWeight: "600" },
  amountInput: { flex: 1, fontSize: 40, fontWeight: "600", color: "#fff" },

  // Merchant grid
  merchantCard: {
    width: "47%",
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#333",
    padding: 12,
    alignItems: "center",
    gap: 6,
  },
  merchantIcon: { fontSize: 22 },
  merchantName: { fontSize: 12, color: "#aaa", textAlign: "center" },

  // Input
  input: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    padding: 14,
    color: "#fff",
    fontSize: 16,
  },

  // Summary
  summaryBox: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 14,
    gap: 6,
  },
  summaryRow: { fontSize: 14 },
  summaryLabel: { color: "#666" },
  summaryValue: { color: "#fff", fontWeight: "500" },

  // Buttons
  nextBtn: {
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  nextBtnText: { color: "#000", fontWeight: "700", fontSize: 16 },

  error: { color: "#ef4444", fontSize: 13 },
  successText: { color: "#22c55e", fontSize: 13 },
});
