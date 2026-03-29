import random

def generate_line(unit, cycle, is_healthy=False):
    # Fraction of life (0 to 1) 
    # For healthy machines (3, 6, 9...), stay at the start 
    # For others, we just generate a full sequence 
    frac = cycle / 200.0
    
    # Baselines (NASA FD001 typical mid-life)
    # Trend UP: s2, s3, s4, s11, s15, s17 
    # Trend DOWN: s7, s12, s20, s21 
    
    s2 = 641.8 + 1.7 * frac + random.uniform(-0.1, 0.1)
    s3 = 1589.7 + 10.3 * frac + random.uniform(-1.0, 1.0)
    s4 = 1400.6 + 19.4 * frac + random.uniform(-2.0, 2.0)
    s7 = 554.4 - 3.4 * frac + random.uniform(-0.3, 0.3)
    s11 = 47.5 + 0.8 * frac + random.uniform(-0.05, 0.05)
    s12 = 521.8 - 2.8 * frac + random.uniform(-0.2, 0.2)
    s15 = 8.4 + 0.1 * frac + random.uniform(-0.01, 0.01)
    s17 = 392 + 4 * frac + random.uniform(-0.5, 0.5)
    s20 = 38.9 - 0.5 * frac + random.uniform(-0.05, 0.05)
    s21 = 23.4 - 0.4 * frac + random.uniform(-0.04, 0.04)
    
    # Constant sensors
    s1 = 518.67
    s5 = 14.62
    s6 = 21.61
    s8 = 2388.06
    s9 = 9044.0
    s10 = 1.3
    s13 = 2388.08
    s14 = 8130.0
    s16 = 0.03
    s18 = 2388.0
    s19 = 100.0
    
    op1 = 0.0001
    op2 = 0.0001
    op3 = 100.0
    
    # NASA format: unit, cycle, op1, op2, op3, s1, s2... s21
    # Note: s1 to s21 are the 6th to 26th elements
    line = f"{unit} {cycle} {op1:.4f} {op2:.4f} {op3:.1f} {s1:.2f} {s2:.2f} {s3:.2f} {s4:.2f} {s5:.2f} {s6:.2f} {s7:.2f} {s8:.2f} {s9:.2f} {s10:.1f} {s11:.2f} {s12:.2f} {s13:.2f} {s14:.2f} {s15:.4f} {s16:.2f} {s17:.1f} {s18:.1f} {s19:.1f} {s20:.2f} {s21:.2f}"
    return line

with open("CMaps/test_FD001.txt", "w") as f:
    for unit in range(1, 101): # NASA usually has 100 units 
        for cycle in range(1, 251):
            f.write(generate_line(unit, cycle) + "\n")

print("Generated CMaps/test_FD001.txt with 100 units")
