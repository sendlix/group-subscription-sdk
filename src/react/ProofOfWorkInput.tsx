import { forwardRef, useEffect, useRef, useState } from "react";
import { ProofOfWork, type PowOptions } from "../proof-of-work";

interface ProofOfWorkInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    sendlix: {
        id: string;
        onStatusChange?: PowOptions["onStatusChange"];
    };
}

const ProofOfWorkInput = forwardRef<HTMLInputElement, ProofOfWorkInputProps>(
    function ProofOfWorkInput({ sendlix, onBlur, onChange, ...rest }, forwardedRef) {
        const [nonce, setNonce] = useState<string | null>(null);
        const [token, setToken] = useState<string | null>(null);
        const [email, setEmail] = useState<string>("");
        const powRef = useRef<ProofOfWork | null>(null);
        const internalRef = useRef<HTMLInputElement | null>(null);
        const lastEmailRef = useRef<string | null>(null);

        const setRef = (el: HTMLInputElement | null) => {
            internalRef.current = el;
            if (typeof forwardedRef === "function") forwardedRef(el);
            else if (forwardedRef) forwardedRef.current = el;
        };

        // Clean up when the component unmounts
        useEffect(() => {
            return () => { powRef.current?.close(); };
        }, []);

        // Cancel renewal when the parent form is submitted
        useEffect(() => {
            const form = internalRef.current?.form;
            if (!form) return;
            const handleSubmit = () => powRef.current?.close();
            form.addEventListener("submit", handleSubmit);
            return () => form.removeEventListener("submit", handleSubmit);
        }, []);

        const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
            onBlur?.(e);
            if (!email || !/\S+@\S+\.\S+/.test(email)) return;

            // Skip if the email hasn't changed and we already have a valid token
            if (email === lastEmailRef.current && nonce && token) return;

            powRef.current?.close();
            powRef.current = null;
            lastEmailRef.current = email;
            setNonce(null);
            setToken(null);

            const pow = new ProofOfWork(sendlix.id, {
                ...(sendlix.onStatusChange && { onStatusChange: sendlix.onStatusChange }),
                onRenew: (result) => {
                    setToken(result.token);
                    setNonce(result.nonce);
                },
            });

            powRef.current = pow;
            pow.init();
            pow.solve(email).then((result) => {
                setToken(result.token);
                setNonce(result.nonce);
            }).catch((error: unknown) => {
                console.error("Proof of Work error:", error);
                setNonce(null);
                setToken(null);
            });
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newEmail = e.target.value;
            onChange?.(e);
            setEmail(newEmail);

            // Invalidate token/nonce when the email changes
            if (newEmail !== lastEmailRef.current && (nonce || token)) {
                powRef.current?.close();
                powRef.current = null;
                setNonce(null);
                setToken(null);
                lastEmailRef.current = null;
            }
        };

        return (
            <>
                <input
                    type="email"
                    {...rest}
                    ref={setRef}
                    value={email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                />
                <input name="pow-nonce" type="hidden" value={nonce ?? ""} readOnly />
                <input name="pow-token" type="hidden" value={token ?? ""} readOnly />
            </>
        );
    },
);

ProofOfWorkInput.displayName = "ProofOfWorkInput";

export default ProofOfWorkInput;