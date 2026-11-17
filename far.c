#include <stdio.h>
int GetInput(char message[]);
void Calculate(int totalWeight, int numStudents);
void Display(float farmerShare, float studentShare);
// Main function
int main(void)
{
    int totalWeight, numStudents;
    totalWeight = GetInput("Enter total weight of strawberries (kg): ");
    numStudents = GetInput("Enter number of students: ");
    Calculate(totalWeight, numStudents);
    return 0;
}
// Function to get input
int GetInput(char message[])
{
    int value;
    printf("%s", message);
    scanf("%d", &value);
    return value;
}
// Function to calculate shares
void Calculate(int totalWeight, int numStudents)
{
    float farmerShare;
    float studentShare;
    farmerShare = totalWeight * 0.5;
    studentShare = (totalWeight * 0.5) / numStudents;
    Display(farmerShare, studentShare);
}
// Function to display results
void Display(float farmerShare, float studentShare)
{
    printf("\nFarmer's share = %.2f kg\n", farmerShare);
   printf("Each student's share = %.2f kg\n", studentShare);
}
