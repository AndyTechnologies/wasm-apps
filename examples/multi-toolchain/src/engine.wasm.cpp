extern "C" {
extern int printf(const char*, ...);
}

extern "C" int compute(int a, int b) {
    return a * b + a;
}