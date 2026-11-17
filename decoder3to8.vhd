library ieee;
use ieee.std_logic_1164.all;
entity decoder3to8 is port (X, Y, Z: in std_logic; D0, D1, D2, D3, D4, D5, D6, D7: out std_logic);
end entity decoder3to8;

architecture labthree of decoder3to8 is
component notgate is port (A, B: in std_logic; C: out std_logic); end component;
component andgate is port (A, B: in std_logic; C: out std_logic); end component;
signal Xbar, Ybar, Zbar: std_logic;
signal p0, p1, p2, p3: std_logic;
begin
G1: notgate port map(A => X, B => X, C => Xbar);
G2: notgate port map(A => Y, B => Y, C => Ybar);
G3: notgate port map(A => Z, B => Z, C => Zbar);

G4: andgate port map(A => Xbar, B => Ybar, C => p0);
G5: andgate port map(A => Xbar, B => Y,    C => p1);
G6: andgate port map(A => X,    B => Ybar, C => p2);
G7: andgate port map(A => X,    B => Y,    C => p3);

G8:  andgate port map(A => p0, B => Zbar, C => D0);
G9:  andgate port map(A => p0, B => Z,    C => D1);
G10: andgate port map(A => p1, B => Zbar, C => D2);
G11: andgate port map(A => p1, B => Z,    C => D3);
G12: andgate port map(A => p2, B => Zbar, C => D4);
G13: andgate port map(A => p2, B => Z,    C => D5);
G14: andgate port map(A => p3, B => Zbar, C => D6);
G15: andgate port map(A => p3, B => Z,    C => D7);
end architecture labthree;
