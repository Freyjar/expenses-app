import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function CalculatorScreen() {
  // Tip calculator
  const [tipBill, setTipBill] = useState("");
  const [tipPercent, setTipPercent] = useState("10");
  const [tipPeople, setTipPeople] = useState("1");

  // Split bill
  const [splitBill, setSplitBill] = useState("");
  const [splitPeople, setSplitPeople] = useState("2");

  const bill = parseFloat(tipBill) || 0;
  const pct = parseFloat(tipPercent) || 0;
  const people = parseInt(tipPeople) || 1;
  const tip = bill * (pct / 100);
  const total = bill + tip;
  const perPerson = total / people;

  const splitTotal = parseFloat(splitBill) || 0;
  const splitN = parseInt(splitPeople) || 1;
  const splitPer = splitTotal / splitN;

  function fmt(n) {
    return (
      "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })
    );
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Tip Calculator */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tip Calculator</Text>

        <Text style={styles.label}>Bill amount</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor="#555"
          value={tipBill}
          onChangeText={setTipBill}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Tip %</Text>
        <View style={styles.tipRow}>
          {["5", "10", "15", "20"].map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tipPill, tipPercent === p && styles.tipPillActive]}
              onPress={() => setTipPercent(p)}>
              <Text
                style={[
                  styles.tipPillText,
                  tipPercent === p && styles.tipPillTextActive,
                ]}>
                {p}%
              </Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Custom"
            placeholderTextColor="#555"
            value={tipPercent}
            onChangeText={setTipPercent}
            keyboardType="decimal-pad"
          />
        </View>

        <Text style={styles.label}>Number of people</Text>
        <TextInput
          style={styles.input}
          placeholder="1"
          placeholderTextColor="#555"
          value={tipPeople}
          onChangeText={setTipPeople}
          keyboardType="number-pad"
        />

        <View style={styles.result}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Tip amount</Text>
            <Text style={styles.resultValue}>{fmt(tip)}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Total bill</Text>
            <Text style={styles.resultValue}>{fmt(total)}</Text>
          </View>
          <View style={[styles.resultRow, styles.resultRowLast]}>
            <Text style={styles.resultLabel}>Per person</Text>
            <Text style={[styles.resultValue, styles.resultValueBig]}>
              {fmt(perPerson)}
            </Text>
          </View>
        </View>
      </View>

      {/* Split Bill */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Split Bill</Text>

        <Text style={styles.label}>Total bill</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor="#555"
          value={splitBill}
          onChangeText={setSplitBill}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Number of people</Text>
        <TextInput
          style={styles.input}
          placeholder="2"
          placeholderTextColor="#555"
          value={splitPeople}
          onChangeText={setSplitPeople}
          keyboardType="number-pad"
        />

        <View style={styles.result}>
          <View style={[styles.resultRow, styles.resultRowLast]}>
            <Text style={styles.resultLabel}>Each person pays</Text>
            <Text style={[styles.resultValue, styles.resultValueBig]}>
              {fmt(splitPer)}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  section: {
    margin: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  label: {
    color: "#888",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 4,
  },
  tipRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 4,
  },
  tipPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#333",
    backgroundColor: "#2a2a2a",
  },
  tipPillActive: { borderColor: "#fff" },
  tipPillText: { color: "#888", fontWeight: "500" },
  tipPillTextActive: { color: "#fff" },
  result: {
    backgroundColor: "#2a2a2a",
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  resultRowLast: { borderBottomWidth: 0 },
  resultLabel: { color: "#888", fontSize: 14 },
  resultValue: { color: "#22c55e", fontWeight: "600", fontSize: 14 },
  resultValueBig: { fontSize: 18 },
});
