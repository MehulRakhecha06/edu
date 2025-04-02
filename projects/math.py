n= int(input("give any number:"))
f=len(str(n))
print("length of number is:",f)
temp =n
arm =0
while temp>0:
    reminder = temp%10
    temp=temp//10
    arm+=reminder**f
if arm == n:
    print("armstrong")
else:
    print("not armstrong")