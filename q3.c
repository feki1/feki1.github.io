#include <stdio.h>

int sum(int n);  // Function declaration

int main(void) {
    int num;

    printf("Enter a positive integer: ");
    scanf("%d", &num);

    printf("Sum from 1 to %d is %d\n", num, sum(num));

    return 0;
}

// Function definition
int sum(int n) {
    if (n <= 1)
        return 1;
    else
        return n + sum(n - 1);
}
