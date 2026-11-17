#include "strawberry.h"

// Function to calculate shares
void Calculate(int totalWeight, int numStudents) {
    float farmerShare;
    float studentShare;

    farmerShare = totalWeight * 0.5;
    studentShare = (totalWeight * 0.5) / numStudents;

    Display(farmerShare, studentShare);
}
