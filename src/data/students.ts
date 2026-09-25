export type Student = { roll: string; name: string };

export const STUDENTS: Student[] = [
  { roll: "20250132001", name: "Aakansha Johari" },
  { roll: "20250132044", name: "Shivam Singh" },
  { roll: "20250132061", name: "Akshat Jha" },
  { roll: "20250132069", name: "Eishita Mehta" },
  { roll: "20250132070", name: "Ekagra Sharma" },
  { roll: "20250132080", name: "Mudit Kedia" },
  { roll: "20250132081", name: "Nandini Sharma" },
  { roll: "20250132088", name: "Preksha Devendra Sharma" },
  { roll: "20250132092", name: "Rik Sengupta" },
  { roll: "20250132097", name: "Saswat Pani" },
  { roll: "20250132098", name: "Satvik Vashisth" },
  { roll: "20250132104", name: "Shruti Shantanu Chanda" },
  { roll: "20250132107", name: "Souvik Bardhan" },
  { roll: "20250132118", name: "Anant Garg" },
  { roll: "20250132127", name: "Karan Pal" },
  { roll: "20250132138", name: "Nidigonda V N Krushna Prahas" },
  { roll: "20250132141", name: "Parthiva Mewawala" },
  { roll: "20250132142", name: "Priya Ghosh" },
  { roll: "20250132144", name: "Raj Mehta" },
  { roll: "20250132147", name: "Rana Khan" },
  { roll: "20250132169", name: "Vrinda Gupta" },
  { roll: "20250407001", name: "Aashutosh Rath" },
  { roll: "20250407005", name: "Aditya Arora" },
  { roll: "20250407007", name: "Amiya Anshu" },
  { roll: "20250407010", name: "Anand Dutta" },
  { roll: "20250407018", name: "Ayan Kashyap" },
  { roll: "20250407023", name: "Digvijay Singh Rathore" },
  { roll: "20250407024", name: "Diya Nirav Vakharia" },
  { roll: "20250407029", name: "Himanshi Agrawal" },
  { roll: "20250407031", name: "Himnish Singh" },
  { roll: "20250407032", name: "Kavyarajsinh Kamlesh Sisodiya" },
  { roll: "20250407034", name: "Khushi Nagpal" },
  { roll: "20250407040", name: "Om Metesh Doshi" },
  { roll: "20250407042", name: "Peddi Koushik" },
  { roll: "20250407043", name: "Piyush Gathania" },
  { roll: "20250407046", name: "Ritwik Mahesh Desai" },
  { roll: "20250407047", name: "Sagarika Mathur" },
  { roll: "20250407051", name: "Shreyanshu Tiwary" },
  { roll: "20250407053", name: "Swapnil Mishra" },
  { roll: "20250407054", name: "Tanmay Mittal" },
  { roll: "20250407055", name: "Vatsala Rastogi" },
  { roll: "20250407056", name: "Vedant Singh" },
  { roll: "20250407061", name: "Khushi R Jain" },
  { roll: "20250407062", name: "Monarchkumar Mistry" },
];

/**
 * Password = first 2 letters of first name + first 2 letters of last name
 * + last 4 digits of roll no. e.g. Aakansha Johari, 20250132001 -> AaJo2001
 * The last word of the name is treated as the last name.
 */
export function passwordFor(s: Student): string {
  const parts = s.name.trim().split(/\s+/);
  const first = parts[0];
  const last = parts[parts.length - 1];
  return first.slice(0, 2) + last.slice(0, 2) + s.roll.slice(-4);
}

export function findStudent(roll: string): Student | undefined {
  return STUDENTS.find((s) => s.roll === roll.trim());
}
