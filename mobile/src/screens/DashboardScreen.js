import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { api } from "../api/client";

const COLORS = {
  food: "#f97316",
  transport: "#3b82f6",
  utilities: "#8b5cf6",
  shopping: "#ec4899",
  health: "#22c55e",
  entertainment: "#eab308",
  other: "#888888",
};

const RANGES = ["week", "month", "year", "all"];

export default function DashboardScreen() {
  const [range, setRange] = useState("month");
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [range]);

  async function loadData() {
    try {
      const [s, st, e] = await Promise.all([
        api.getSummary({ range }),
        api.getStats({ range }),
        api.getExpenses({ range }),
      ]);
      setSummary(s);
      setStats(st);
      setExpenses(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadData();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  // Group expenses by date
  const grouped = {};
  expenses.forEach((e) => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
        />
      }>
      {/* Range pills */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.rangePill, range === r && styles.rangePillActive]}
            onPress={() => setRange(r)}>
            <Text
              style={[
                styles.rangePillText,
                range === r && styles.rangePillTextActive,
              ]}>
              {r === "week"
                ? "This week"
                : r === "month"
                  ? "This month"
                  : r === "year"
                    ? "This year"
                    : "All time"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cards */}
      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Total</Text>
          <Text style={styles.cardValue}>
            ₱{Number(summary?.monthly_total || 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Weekly avg</Text>
          <Text style={styles.cardValue}>
            ₱{Number(stats?.weekly_avg || 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Last month</Text>
          <Text style={styles.cardValue}>
            ₱{Number(stats?.last_month || 0).toLocaleString()}
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Top category</Text>
          <Text style={styles.cardValue}>
            {summary?.by_category?.[0]?.category || "—"}
          </Text>
        </View>
      </View>

      {/* Category breakdown */}
      {summary?.by_category?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By category</Text>
          {summary.by_category.map((c) => {
            const pct = ((c.total / summary.monthly_total) * 100).toFixed(0);
            return (
              <View key={c.category} style={styles.categoryRow}>
                <View style={styles.categoryLeft}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: COLORS[c.category] || "#888" },
                    ]}
                  />
                  <Text style={styles.categoryName}>{c.category}</Text>
                </View>
                <View style={styles.categoryRight}>
                  <Text style={styles.categoryPct}>{pct}%</Text>
                  <Text style={styles.categoryAmount}>
                    ₱{Number(c.total).toLocaleString()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Expense list grouped by date */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Expenses ({expenses.length})</Text>
        {Object.keys(grouped)
          .sort((a, b) => b.localeCompare(a))
          .map((day) => {
            const dayTotal = grouped[day].reduce(
              (sum, e) => sum + parseFloat(e.amount),
              0,
            );
            return (
              <View key={day} style={styles.dateGroup}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateText}>
                    {new Date(day + "T00:00:00").toLocaleDateString("en-PH", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.dateTotalText}>
                    ₱{Number(dayTotal).toLocaleString()}
                  </Text>
                </View>
                {grouped[day].map((e) => (
                  <View key={e.id} style={styles.expenseItem}>
                    <View style={styles.expenseLeft}>
                      <Text style={styles.merchant}>{e.merchant}</Text>
                      {e.note ? (
                        <Text style={styles.note}>{e.note}</Text>
                      ) : null}
                    </View>
                    <View style={styles.expenseRight}>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor:
                              (COLORS[e.category] || "#888") + "22",
                          },
                        ]}>
                        <Text
                          style={[
                            styles.badgeText,
                            { color: COLORS[e.category] || "#888" },
                          ]}>
                          {e.category}
                        </Text>
                      </View>
                      <Text style={styles.amount}>
                        ₱{Number(e.amount).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        {expenses.length === 0 && (
          <Text style={styles.empty}>No expenses for this period.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f0f0f" },
  center: {
    flex: 1,
    backgroundColor: "#0f0f0f",
    justifyContent: "center",
    alignItems: "center",
  },
  rangeRow: { flexDirection: "row", padding: 16, gap: 8, flexWrap: "wrap" },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#333",
    backgroundColor: "#1a1a1a",
  },
  rangePillActive: { borderColor: "#fff" },
  rangePillText: { color: "#888", fontSize: 12, fontWeight: "500" },
  rangePillTextActive: { color: "#fff" },
  cards: { flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8 },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    flex: 1,
    minWidth: "45%",
  },
  cardLabel: {
    color: "#666",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardValue: { color: "#fff", fontSize: 18, fontWeight: "600" },
  section: {
    margin: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: "#888",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  categoryName: { color: "#fff", fontSize: 14 },
  categoryRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  categoryPct: { color: "#555", fontSize: 12 },
  categoryAmount: { color: "#fff", fontSize: 14, fontWeight: "500" },
  dateGroup: { marginBottom: 12 },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    marginBottom: 4,
  },
  dateText: { color: "#888", fontSize: 12 },
  dateTotalText: { color: "#888", fontSize: 12 },
  expenseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
  },
  expenseLeft: { flex: 1 },
  merchant: { color: "#fff", fontSize: 14 },
  note: { color: "#666", fontSize: 12, marginTop: 2 },
  expenseRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: "500" },
  amount: { color: "#fff", fontSize: 14, fontWeight: "600" },
  empty: { color: "#444", textAlign: "center", paddingVertical: 20 },
});
